import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import pytest
from livekit import rtc

from trackb.session.room_client import LiveKitRoomClient


class _FakeLocalParticipant:
    def __init__(self) -> None:
        self.published_tracks: list[Any] = []

    async def publish_track(self, track: Any) -> None:
        self.published_tracks.append(track)


class _FakeRoom:
    def __init__(
        self,
        *,
        connected: bool = True,
        remote_participants: dict[str, Any] | None = None,
        name: str = "room-1",
    ) -> None:
        self._connected = connected
        self.remote_participants: dict[str, Any] = remote_participants or {}
        self.name = name
        self.local_participant = _FakeLocalParticipant()
        self.disconnect_called = False
        self._handlers: dict[str, list[Any]] = {}

    def isconnected(self) -> bool:
        return self._connected

    def on(self, event: str, handler: Any) -> None:
        self._handlers.setdefault(event, []).append(handler)

    def off(self, event: str, handler: Any) -> None:
        self._handlers.get(event, []).remove(handler)

    def emit_participant_connected(self, participant: Any) -> None:
        self.remote_participants[participant.identity] = participant
        for handler in list(self._handlers.get("participant_connected", [])):
            handler(participant)

    async def disconnect(self) -> None:
        self.disconnect_called = True


@dataclass
class _FakeParticipant:
    identity: str


@dataclass
class _FakeFrameEvent:
    frame: rtc.AudioFrame


class _FakeAudioStream:
    def __init__(self, frames: list[rtc.AudioFrame]) -> None:
        self._frames = frames
        self.closed = False

    def __aiter__(self) -> AsyncIterator[_FakeFrameEvent]:
        return self._iter()

    async def _iter(self) -> AsyncIterator[_FakeFrameEvent]:
        for frame in self._frames:
            yield _FakeFrameEvent(frame=frame)

    async def aclose(self) -> None:
        self.closed = True


@dataclass
class _AudioStreamFactory:
    frames: list[rtc.AudioFrame]
    calls: list[dict[str, Any]] = field(default_factory=list)
    created: list[_FakeAudioStream] = field(default_factory=list)

    def __call__(self, **kwargs: Any) -> _FakeAudioStream:
        self.calls.append(kwargs)
        stream = _FakeAudioStream(self.frames)
        self.created.append(stream)
        return stream


class _FakeAudioSource:
    def __init__(self, sample_rate: int, num_channels: int) -> None:
        self.sample_rate = sample_rate
        self.num_channels = num_channels
        self.captured_frames: list[rtc.AudioFrame] = []
        self.closed = False

    async def capture_frame(self, frame: rtc.AudioFrame) -> None:
        self.captured_frames.append(frame)

    async def aclose(self) -> None:
        self.closed = True


@dataclass
class _FakeLocalTrack:
    name: str
    source: Any


def _make_client(
    room: _FakeRoom,
    *,
    audio_stream_factory: Any = None,
    audio_sources: list[_FakeAudioSource] | None = None,
) -> LiveKitRoomClient:
    sources = audio_sources if audio_sources is not None else []

    def _source_factory(sample_rate: int, num_channels: int) -> _FakeAudioSource:
        source = _FakeAudioSource(sample_rate, num_channels)
        sources.append(source)
        return source

    return LiveKitRoomClient(
        room,
        audio_stream_factory=audio_stream_factory,
        audio_source_factory=_source_factory,
        local_audio_track_factory=lambda name, source: _FakeLocalTrack(name, source),
    )


@pytest.mark.asyncio
async def test_connect_is_noop_when_room_already_connected() -> None:
    room = _FakeRoom(connected=True)
    client = _make_client(room)

    await client.connect(url="ignored", token="ignored")


@pytest.mark.asyncio
async def test_connect_raises_when_room_not_connected() -> None:
    room = _FakeRoom(connected=False)
    client = _make_client(room)

    with pytest.raises(RuntimeError, match="not connected"):
        await client.connect(url="ignored", token="ignored")


@pytest.mark.asyncio
async def test_audio_frames_yields_bytes_from_already_present_participant() -> None:
    participant = _FakeParticipant(identity="caller-1")
    room = _FakeRoom(remote_participants={"caller-1": participant})
    frame1 = rtc.AudioFrame(
        data=b"\x01\x00" * 4, sample_rate=16_000, num_channels=1, samples_per_channel=4
    )
    frame2 = rtc.AudioFrame(
        data=b"\x02\x00" * 4, sample_rate=16_000, num_channels=1, samples_per_channel=4
    )
    factory = _AudioStreamFactory(frames=[frame1, frame2])
    client = _make_client(room, audio_stream_factory=factory)

    received = [chunk async for chunk in client.audio_frames()]

    assert received == [b"\x01\x00" * 4, b"\x02\x00" * 4]
    assert factory.calls[0]["participant"] is participant
    assert factory.created[0].closed is True


@pytest.mark.asyncio
async def test_audio_frames_waits_for_participant_connected_event() -> None:
    room = _FakeRoom(remote_participants={})
    frame = rtc.AudioFrame(
        data=b"\x03\x00" * 4, sample_rate=16_000, num_channels=1, samples_per_channel=4
    )
    factory = _AudioStreamFactory(frames=[frame])
    client = _make_client(room, audio_stream_factory=factory)

    received: list[bytes] = []

    async def _consume() -> None:
        async for chunk in client.audio_frames():
            received.append(chunk)

    task = asyncio.create_task(_consume())
    await asyncio.sleep(0.05)
    assert received == []

    room.emit_participant_connected(_FakeParticipant(identity="caller-2"))
    await asyncio.wait_for(task, timeout=1.0)

    assert received == [b"\x03\x00" * 4]


@pytest.mark.asyncio
async def test_publish_audio_publishes_track_once_and_reuses_it() -> None:
    room = _FakeRoom()
    sources: list[_FakeAudioSource] = []
    client = _make_client(room, audio_sources=sources)

    await client.publish_audio(b"\x00\x01" * 8)
    await client.publish_audio(b"\x00\x02" * 8)

    assert len(room.local_participant.published_tracks) == 1
    assert len(sources) == 1
    assert len(sources[0].captured_frames) == 2
    assert sources[0].captured_frames[0].samples_per_channel == 8
    assert bytes(sources[0].captured_frames[1].data.cast("b")) == b"\x00\x02" * 8


@pytest.mark.asyncio
async def test_disconnect_closes_audio_source_and_room() -> None:
    room = _FakeRoom()
    sources: list[_FakeAudioSource] = []
    client = _make_client(room, audio_sources=sources)

    await client.publish_audio(b"\x00\x01" * 8)
    await client.disconnect()

    assert sources[0].closed is True
    assert room.disconnect_called is True


@pytest.mark.asyncio
async def test_disconnect_without_publishing_still_disconnects_room() -> None:
    room = _FakeRoom()
    client = _make_client(room)

    await client.disconnect()

    assert room.disconnect_called is True
