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

A concrete `LiveKitRoomClient` adapter, once that decision is made, maps roughly as:
- `connect()` -> `ctx.connect()` inside that `entrypoint`, after the job hands it a room
- `audio_frames()` -> subscribing to a remote participant's track and iterating the resulting
  `rtc.AudioStream` of `rtc.AudioFrame`s (`.data` gives a memoryview of raw PCM16 samples;
  `bytes(frame.data.cast("b"))` gives the raw bytes `WhisperSTT.push_audio` expects)
- `publish_audio()` -> publishing frames to a local `rtc.AudioSource` bound to a
  `rtc.LocalAudioTrack`
- `disconnect()` -> `ctx.room.disconnect()`

Nothing in `SessionWorker` should need to change to accommodate that adapter, since it only
depends on this `Protocol`.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Protocol, runtime_checkable


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
