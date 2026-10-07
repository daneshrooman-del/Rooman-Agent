import asyncio
from collections.abc import AsyncIterator
from typing import Any

import numpy as np
import pytest
from livekit import rtc

from trackb.avatar.output import AvatarAVOutput

FPS = 25
SR = 16_000
BYTES_PER_FRAME = SR // FPS * 2  # 640 samples of PCM16 = 1280 bytes


class _Renderer:
    fps, width, height = FPS, 8, 4

    def idle_frame(self, index: int) -> np.ndarray:
        return np.full((4, 8, 4), 7, dtype=np.uint8)

    async def render(self, audio: bytes) -> AsyncIterator[np.ndarray]:
        for i in range(-(-len(audio) // BYTES_PER_FRAME)):
            yield np.full((4, 8, 4), i % 255, dtype=np.uint8)


class _Sync:
    def __init__(self, **kwargs: Any) -> None:
        self.kwargs = kwargs
        self.pushed: list[tuple[str, Any]] = []
        self.playout = asyncio.Event()
        self.resets = 0
        self.cleared = False
        self.closed = False

    async def push(self, frame: Any) -> None:
        kind = "video" if isinstance(frame, rtc.VideoFrame) else "audio"
        self.pushed.append((kind, frame))

    async def wait_for_playout(self) -> None:
        await self.playout.wait()

    def reset(self) -> None:
        self.resets += 1

    async def clear_queue(self) -> None:
        self.cleared = True

    async def aclose(self) -> None:
        self.closed = True


class _VideoSource:
    def __init__(self) -> None:
        self.captured = 0

    def capture_frame(self, frame: Any) -> None:
        self.captured += 1


def _output() -> tuple[AvatarAVOutput, _Sync, _VideoSource]:
    holder: dict[str, _Sync] = {}

    def factory(**kwargs: Any) -> _Sync:
        holder["sync"] = _Sync(**kwargs)
        return holder["sync"]

    video = _VideoSource()
    out = AvatarAVOutput(_Renderer(), audio_source=object(), video_source=video,
                         synchronizer_factory=factory)
    return out, holder["sync"], video


@pytest.mark.asyncio
async def test_say_interleaves_each_frame_with_its_audio_window() -> None:
    out, sync, _ = _output()
    audio = bytes(range(256)) * 20  # 5120 bytes = 4 full windows of 1280

    await out.say(audio + b"\x01\x02" * 10)  # + a partial 5th window (20 bytes)

    kinds = [k for k, _ in sync.pushed]
    assert kinds == ["video", "audio"] * 5
    audio_frames = [f for k, f in sync.pushed if k == "audio"]
    assert [f.samples_per_channel for f in audio_frames] == [640] * 4 + [10]
    assert bytes(audio_frames[1].data.cast("B")) == audio[1280:2560]
    assert sync.kwargs["video_fps"] == FPS and sync.kwargs["video_queue_size_ms"] == 100


@pytest.mark.asyncio
async def test_idle_frames_pause_while_speaking_until_playout_then_resume() -> None:
    out, sync, video = _output()
    out.start()
    await asyncio.sleep(0.15)
    idle_before = video.captured
    assert idle_before >= 2

    await out.say(b"\x00" * BYTES_PER_FRAME * 2)
    assert out.speaking  # pushed, still playing out
    paused_at = video.captured
    await asyncio.sleep(0.15)
    assert video.captured == paused_at  # no idle frames over speech

    sync.playout.set()
    await asyncio.sleep(0.15)
    assert not out.speaking
    assert video.captured > paused_at  # idle resumed
    await out.aclose()
    assert sync.closed


@pytest.mark.asyncio
async def test_back_to_back_clips_reset_fps_controller_only_after_idle() -> None:
    out, sync, _ = _output()

    await out.say(b"\x00" * BYTES_PER_FRAME)
    await out.say(b"\x00" * BYTES_PER_FRAME)  # first clip still playing out
    assert sync.resets == 1

    sync.playout.set()
    await asyncio.sleep(0.01)
    await out.say(b"\x00" * BYTES_PER_FRAME)
    assert sync.resets == 2
    await out.clear()
    assert sync.cleared
    await out.aclose()


class _IndexRenderer(_Renderer):
    """Frame i is filled with value i; optionally stalls after `burst` frames."""

    def __init__(self, burst: int | None = None, stall: float = 0.0) -> None:
        self.burst, self.stall = burst, stall

    async def render(self, audio: bytes) -> AsyncIterator[np.ndarray]:
        for i in range(-(-len(audio) // BYTES_PER_FRAME)):
            if self.burst is not None and i == self.burst:
                await asyncio.sleep(self.stall)
            yield np.full((4, 8, 4), i, dtype=np.uint8)


def _output_with(renderer: _Renderer) -> tuple[AvatarAVOutput, _Sync]:
    holder: dict[str, _Sync] = {}

    def factory(**kwargs: Any) -> _Sync:
        holder["sync"] = _Sync(**kwargs)
        return holder["sync"]

    out = AvatarAVOutput(renderer, audio_source=object(), video_source=_VideoSource(),
                         synchronizer_factory=factory)
    return out, holder["sync"]


def _shown(sync: _Sync) -> list[int]:
    return [int(np.frombuffer(f.data, dtype=np.uint8)[0]) for k, f in sync.pushed if k == "video"]


@pytest.mark.asyncio
async def test_audio_never_waits_for_a_stalled_renderer() -> None:
    # Renderer yields one batch (8 frames) then stalls for 2 s -- longer than the whole clip.
    out, sync = _output_with(_IndexRenderer(burst=8, stall=2.0))
    audio = b"\x00" * BYTES_PER_FRAME * 20

    started = asyncio.get_running_loop().time()
    await out.say(audio)

    assert asyncio.get_running_loop().time() - started < 1.0  # didn't wait for the stall
    kinds = [k for k, _ in sync.pushed]
    assert kinds.count("audio") == 20 and kinds.count("video") == 20  # every window on time
    assert _shown(sync) == list(range(8)) + [7] * 12  # last ready frame repeated
    await out.aclose()


@pytest.mark.asyncio
async def test_frames_arriving_after_their_window_are_skipped_not_shown_late() -> None:
    out, sync = _output_with(_IndexRenderer(burst=8, stall=0.0))
    audio = b"\x00" * BYTES_PER_FRAME * 12
    # Make the renderer deliver frames 8.. only after windows 8 and 9 have been pushed.
    original_push = sync.push
    pushed_video = 0

    async def slow_push(frame: Any) -> None:
        nonlocal pushed_video
        await original_push(frame)
        if isinstance(frame, rtc.VideoFrame):
            pushed_video += 1
            if pushed_video in (9, 10):
                await asyncio.sleep(0)  # let the producer run late

    sync.push = slow_push  # type: ignore[method-assign]
    await out.say(audio)

    shown = _shown(sync)
    assert len(shown) == 12
    assert all(shown[w] <= w for w in range(12))  # never a frame ahead of its audio window
    assert shown == sorted(shown)  # never goes backwards
    await out.aclose()


@pytest.mark.asyncio
async def test_fast_renderer_shows_every_frame_in_its_own_window() -> None:
    out, sync = _output_with(_IndexRenderer())
    await out.say(b"\x00" * BYTES_PER_FRAME * 15)
    assert _shown(sync) == list(range(15))
    await out.aclose()
