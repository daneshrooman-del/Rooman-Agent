"""Publish the agent's speech as lip-synced audio + video through LiveKit.

Speech goes through `rtc.AVSynchronizer`: for each video frame the renderer yields, push that
frame and then the `1 / fps` s of audio it shows (`FaceRenderer`'s 1:1 contract). Video is paced
at `fps` by the synchronizer; audio paces itself through `AudioSource.capture_frame`. Both
buffers are kept short (`queue_ms`, default 100 ms) so neither stream can run far ahead -- with
LiveKit's default 1 s audio queue the voice could lead the face by most of a second.

Between replies an idle loop writes `idle_frame(i)` straight to the video source at `fps`, so the
face never freezes. Idle frames deliberately bypass the synchronizer: queued idle frames would
delay the start of the next reply's video relative to its audio. The idle loop resumes only once
a reply has fully played out (`wait_for_playout`), so back-to-back sentences from
`SessionWorker.speak_stream` aren't interleaved with idle frames.
"""

from __future__ import annotations

import asyncio
import contextlib
from collections.abc import Callable
from typing import Any

import structlog
from livekit import rtc

from trackb.avatar.renderer import FaceRenderer, Frame
from trackb.tts.base import TTS_SAMPLE_RATE

logger = structlog.get_logger(__name__)

_BYTES_PER_SAMPLE = 2


def _video_frame(frame: Frame) -> rtc.VideoFrame:
    height, width = frame.shape[:2]
    return rtc.VideoFrame(width, height, rtc.VideoBufferType.RGBA, frame.tobytes())


class AvatarAVOutput:
    def __init__(
        self,
        renderer: FaceRenderer,
        *,
        sample_rate: int = TTS_SAMPLE_RATE,
        num_channels: int = 1,
        queue_ms: int = 100,
        audio_source: Any | None = None,
        video_source: Any | None = None,
        synchronizer_factory: Callable[..., Any] | None = None,
    ) -> None:
        self._renderer = renderer
        self._sample_rate = sample_rate
        self._num_channels = num_channels
        self._bytes_per_frame = (sample_rate // renderer.fps) * _BYTES_PER_SAMPLE * num_channels
        self.audio_source = audio_source or rtc.AudioSource(
            sample_rate, num_channels, queue_size_ms=queue_ms
        )
        self.video_source = video_source or rtc.VideoSource(renderer.width, renderer.height)
        self._sync = (synchronizer_factory or rtc.AVSynchronizer)(
            audio_source=self.audio_source,
            video_source=self.video_source,
            video_fps=renderer.fps,
            video_queue_size_ms=queue_ms,
        )
        self._busy = 0  # replies being pushed or still playing out
        self._say_lock = asyncio.Lock()
        self._idle_task: asyncio.Task[None] | None = None
        self._playout_tasks: set[asyncio.Task[None]] = set()

    def start(self) -> None:
        if self._idle_task is None:
            self._idle_task = asyncio.create_task(self._idle_loop())

    async def say(self, audio: bytes) -> None:
        """Push one clip of speech with its rendered frames; returns once all of it is queued
        (≈ `queue_ms` before it finishes playing), so the next clip can follow seamlessly."""
        async with self._say_lock:
            if self._busy == 0:
                self._sync.reset()  # don't let the fps controller "catch up" after an idle gap
            self._busy += 1
            try:
                index = 0
                async for frame in self._renderer.render(audio):
                    await self._sync.push(_video_frame(frame))
                    start = index * self._bytes_per_frame
                    chunk = audio[start : start + self._bytes_per_frame]
                    if chunk:
                        await self._sync.push(self._audio_frame(chunk))
                    index += 1
                rest = audio[index * self._bytes_per_frame :]
                if rest:
                    await self._sync.push(self._audio_frame(rest))
            finally:
                task = asyncio.create_task(self._release_after_playout())
                self._playout_tasks.add(task)
                task.add_done_callback(self._playout_tasks.discard)

    async def clear(self) -> None:
        """Drop queued audio and video (for interruptions / barge-in)."""
        await self._sync.clear_queue()

    async def aclose(self) -> None:
        for task in [self._idle_task, *self._playout_tasks]:
            if task is not None:
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task
        await self._sync.aclose()

    @property
    def speaking(self) -> bool:
        return self._busy > 0

    async def _release_after_playout(self) -> None:
        try:
            await self._sync.wait_for_playout()
        finally:
            self._busy -= 1

    async def _idle_loop(self) -> None:
        loop = asyncio.get_running_loop()
        period = 1.0 / self._renderer.fps
        index = 0
        next_tick = loop.time()
        while True:
            if self._busy == 0:
                try:
                    self.video_source.capture_frame(_video_frame(self._renderer.idle_frame(index)))
                except Exception as exc:  # a dropped idle frame must not end the loop
                    logger.warning("avatar_idle_frame_failed", error=str(exc))
                index += 1
            next_tick += period
            delay = next_tick - loop.time()
            if delay < -1.0:  # fell far behind (e.g. event loop stalled): resync, don't burst
                next_tick = loop.time()
                delay = 0.0
            await asyncio.sleep(max(0.0, delay))

    def _audio_frame(self, chunk: bytes) -> rtc.AudioFrame:
        return rtc.AudioFrame(
            data=chunk,
            sample_rate=self._sample_rate,
            num_channels=self._num_channels,
            samples_per_channel=len(chunk) // (_BYTES_PER_SAMPLE * self._num_channels),
        )
