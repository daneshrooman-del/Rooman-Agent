"""Minimal interface this module needs from a live LiveKit room connection.

`livekit-agents` (1.8.3, confirmed installed and importable at write time) structures a worker
around a framework-called `entrypoint(ctx: JobContext)` registered via
`WorkerOptions(entrypoint_fnc=...)` + `agents.cli.run_app(...)` -- the framework owns job
dispatch (which room, which credentials) and calls `entrypoint` per job; it is not a
`connect(url, token)` you call on demand the way this Protocol models it. Reconciling
`SessionWorker` with that model -- i.e. deciding whether one intake/deployed-agent session
maps to one dispatched job, who runs `cli.run_app`, and how Track C's API layer triggers a
job for a given `session_id` -- is an architecture decision that reaches into Track C and was
out of scope here, so this stays a small, hand-rolled `Protocol` capturing just what
`SessionWorker` needs, rather than a wrapper around the real SDK.

`LiveKitRoomClient` below is the concrete adapter for that real SDK, confirmed against the
installed `livekit-agents`/`livekit-rtc` 1.8.3 source (`inspect.signature` on `rtc.Room`,
`rtc.AudioStream`, `rtc.AudioSource`, `rtc.LocalAudioTrack`, `agents.JobContext`):

- `connect()` is a **no-op that asserts the room is already connected**, not a real
  `Room.connect(url, token)` call -- see its docstring for why.
- `audio_frames()` waits for a remote participant to be present in `room.remote_participants`
  (subscribing to `Room`'s `participant_connected` event if none has joined yet), then
  subscribes to their microphone track via `rtc.AudioStream.from_participant(...)` and yields
  `bytes(frame.data.cast("b"))` per `rtc.AudioFrameEvent` -- raw PCM16 samples, exactly what
  `WhisperSTT.push_audio` expects.
- `publish_audio()` lazily creates an `rtc.AudioSource` + `rtc.LocalAudioTrack`, publishes it
  once via `room.local_participant.publish_track(...)`, and calls `audio_source.capture_frame()`
  per call thereafter.
- `disconnect()` closes the audio source (if one was ever created) and calls
  `room.disconnect()`.

Nothing in `SessionWorker` needed to change to accommodate this adapter, since it only depends
on the `RoomClient` Protocol below.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Callable, Mapping
from typing import Any, Protocol, runtime_checkable

import structlog
from livekit import rtc

logger = structlog.get_logger(__name__)

DEFAULT_SAMPLE_RATE = 16_000
DEFAULT_NUM_CHANNELS = 1
_PUBLISHED_TRACK_NAME = "trackb-agent-voice"
_BYTES_PER_SAMPLE = 2  # PCM16


@runtime_checkable
class RoomClient(Protocol):
    async def connect(self, *, url: str, token: str) -> None:
        """Join the room. Should raise on failure rather than hanging silently."""
        ...

    def audio_frames(self) -> AsyncIterator[bytes]:
        """Async iterator of raw PCM16 mono audio frames from the remote participant."""
        ...

    async def publish_audio(self, audio: bytes) -> None:
        """Publish raw PCM16 mono audio to the room (e.g. synthesized speech)."""
        ...

    async def disconnect(self) -> None:
        """Leave the room and release any underlying resources."""
        ...


class LiveKitRoomClient:
    """Adapts an already-connected `rtc.Room` to the `RoomClient` protocol.

    The LiveKit Agents job-dispatch model hands an entrypoint a `JobContext` for a room the
    framework has already (or is about to be, via `ctx.connect()`) joined -- there is no
    `url`/`token` pair to connect with on demand the way `RoomClient.connect()` is shaped.
    Construct this with the `rtc.Room` obtained from `ctx.room` *after* `await ctx.connect()`
    has run in the entrypoint; `connect()` here then only asserts that invariant instead of
    duplicating it, so `SessionWorker.join()` (written against the Protocol, by another agent,
    before this reconciliation) needs no changes.

    `audio_stream_factory` / `audio_source_factory` / `local_audio_track_factory` default to
    the real `rtc.AudioStream.from_participant` / `rtc.AudioSource` /
    `rtc.LocalAudioTrack.create_audio_track`, and exist as injection seams so tests can supply
    lightweight fakes instead of exercising LiveKit's real FFI layer (which needs a live
    server connection).
    """

    def __init__(
        self,
        room: rtc.Room,
        *,
        sample_rate: int = DEFAULT_SAMPLE_RATE,
        num_channels: int = DEFAULT_NUM_CHANNELS,
        participant_wait_timeout_seconds: float = 30.0,
        audio_stream_factory: Callable[..., AsyncIterator[Any]] | None = None,
        audio_source_factory: Callable[[int, int], Any] | None = None,
        local_audio_track_factory: Callable[[str, Any], Any] | None = None,
    ) -> None:
        self._room = room
        self._sample_rate = sample_rate
        self._num_channels = num_channels
        self._participant_wait_timeout_seconds = participant_wait_timeout_seconds
        self._audio_stream_factory = audio_stream_factory or rtc.AudioStream.from_participant
        self._audio_source_factory: Callable[[int, int], Any] = (
            audio_source_factory or rtc.AudioSource
        )
        self._local_audio_track_factory: Callable[[str, Any], Any] = (
            local_audio_track_factory or rtc.LocalAudioTrack.create_audio_track
        )

        self._audio_source: Any | None = None
        self._published = False

    async def connect(self, *, url: str = "", token: str = "") -> None:
        """No-op beyond asserting the room is already connected.

        `url`/`token` are accepted only to satisfy the `RoomClient` Protocol's shape and are
        otherwise unused -- the real connection already happened via `ctx.connect()` before
        this adapter was constructed. See class docstring.
        """
        if not self._room.isconnected():
            raise RuntimeError(
                "LiveKitRoomClient.connect() was called but the underlying rtc.Room is not "
                "connected. This adapter assumes `await ctx.connect()` already ran in the "
                "entrypoint before constructing LiveKitRoomClient(ctx.room) -- it does not "
                "perform an on-demand connect itself."
            )
        logger.debug("room_client_connect_noop", room=getattr(self._room, "name", None))

    async def _wait_for_remote_participant(self) -> rtc.RemoteParticipant:
        participants: Mapping[str, rtc.RemoteParticipant] = self._room.remote_participants
        if participants:
            return next(iter(participants.values()))

        loop = asyncio.get_event_loop()
        found: asyncio.Future[rtc.RemoteParticipant] = loop.create_future()

        def _on_participant_connected(participant: rtc.RemoteParticipant) -> None:
            if not found.done():
                found.set_result(participant)

        self._room.on("participant_connected", _on_participant_connected)
        try:
            return await asyncio.wait_for(
                found, timeout=self._participant_wait_timeout_seconds
            )
        finally:
            self._room.off("participant_connected", _on_participant_connected)

    async def audio_frames(self) -> AsyncIterator[bytes]:
        participant = await self._wait_for_remote_participant()
        logger.info(
            "room_client_subscribed_audio",
            room=getattr(self._room, "name", None),
            participant=participant.identity,
        )
        stream = self._audio_stream_factory(
            participant=participant,
            track_source=rtc.TrackSource.SOURCE_MICROPHONE,
            sample_rate=self._sample_rate,
            num_channels=self._num_channels,
        )
        try:
            async for event in stream:
                frame = event.frame
                yield bytes(frame.data.cast("b"))
        finally:
            aclose = getattr(stream, "aclose", None)
            if aclose is not None:
                await aclose()

    async def _ensure_audio_published(self) -> None:
        if self._published:
            return
        self._audio_source = self._audio_source_factory(self._sample_rate, self._num_channels)
        track = self._local_audio_track_factory(_PUBLISHED_TRACK_NAME, self._audio_source)
        await self._room.local_participant.publish_track(track)
        self._published = True
        logger.info("room_client_audio_published", room=getattr(self._room, "name", None))

    async def publish_audio(self, audio: bytes) -> None:
        await self._ensure_audio_published()
        assert self._audio_source is not None
        samples_per_channel = len(audio) // (_BYTES_PER_SAMPLE * self._num_channels)
        frame = rtc.AudioFrame(
            data=audio,
            sample_rate=self._sample_rate,
            num_channels=self._num_channels,
            samples_per_channel=samples_per_channel,
        )
        await self._audio_source.capture_frame(frame)

    async def disconnect(self) -> None:
        if self._audio_source is not None:
            aclose = getattr(self._audio_source, "aclose", None)
            if aclose is not None:
                await aclose()
        await self._room.disconnect()
        logger.info("room_client_disconnected", room=getattr(self._room, "name", None))
