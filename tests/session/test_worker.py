import asyncio
from collections.abc import AsyncIterator

import pytest

from trackb.session.concurrency import SessionConcurrencyGuard
from trackb.session.errors import SessionCapacityError
from trackb.session.worker import SessionWorker, TranscribedUtterance
from trackb.stt.whisper_stt import TranscriptEvent


class _FakeRoomClient:
    def __init__(self, frames: list[bytes]) -> None:
        self._frames = frames
        self.connect_calls: list[tuple[str, str]] = []
        self.published: list[bytes] = []
        self.disconnected = False
        self._stop = asyncio.Event()

    async def connect(self, *, url: str, token: str) -> None:
        self.connect_calls.append((url, token))

    async def audio_frames(self) -> AsyncIterator[bytes]:
        for frame in self._frames:
            yield frame
        await self._stop.wait()

    async def publish_audio(self, audio: bytes) -> None:
        self.published.append(audio)

    async def disconnect(self) -> None:
        self.disconnected = True
        self._stop.set()


class _FakeSTT:
    def __init__(self) -> None:
        self.pushed: list[bytes] = []
        self.closed = False
        self._queue: asyncio.Queue[TranscriptEvent] = asyncio.Queue()

    async def push_audio(self, chunk: bytes) -> None:
        self.pushed.append(chunk)

    async def events(self) -> AsyncIterator[TranscriptEvent]:
        while not self.closed or not self._queue.empty():
            try:
                event = await asyncio.wait_for(self._queue.get(), timeout=0.05)
            except asyncio.TimeoutError:
                continue
            yield event

    async def aclose(self) -> None:
        self.closed = True

    async def emit(self, event: TranscriptEvent) -> None:
        await self._queue.put(event)


@pytest.mark.asyncio
async def test_join_connects_and_wires_audio_frames_into_stt() -> None:
    room = _FakeRoomClient(frames=[b"frame1", b"frame2"])
    stt = _FakeSTT()
    worker = SessionWorker(session_id="sess-1", room_client=room, stt=stt)

    await worker.join(url="ws://livekit.local", token="tok")
    await asyncio.sleep(0.05)

    assert room.connect_calls == [("ws://livekit.local", "tok")]
    assert stt.pushed == [b"frame1", b"frame2"]

    await worker.leave()


@pytest.mark.asyncio
async def test_transcript_events_reach_registered_handler_with_session_id() -> None:
    room = _FakeRoomClient(frames=[])
    stt = _FakeSTT()
    worker = SessionWorker(session_id="sess-2", room_client=room, stt=stt)
    received: list[TranscribedUtterance] = []

    async def handler(utterance: TranscribedUtterance) -> None:
        received.append(utterance)

    worker.on_utterance(handler)
    await worker.join(url="ws://livekit.local", token="tok")

    await stt.emit(TranscriptEvent(text="hello", is_final=False))
    await stt.emit(TranscriptEvent(text="hello world", is_final=True))
    await asyncio.sleep(0.1)

    assert [(u.text, u.is_final) for u in received] == [
        ("hello", False),
        ("hello world", True),
    ]
    assert all(u.session_id == "sess-2" for u in received)

    await worker.leave()


@pytest.mark.asyncio
async def test_speak_without_tts_raises_clear_error() -> None:
    worker = SessionWorker(session_id="sess-3", room_client=_FakeRoomClient([]), stt=_FakeSTT())

    with pytest.raises(NotImplementedError, match="tts"):
        await worker.speak("hi there")


@pytest.mark.asyncio
async def test_speak_synthesizes_via_tts_and_publishes_to_room() -> None:
    room = _FakeRoomClient(frames=[])

    async def fake_tts(text: str) -> bytes:
        return f"AUDIO:{text}".encode()

    worker = SessionWorker(session_id="sess-4", room_client=room, stt=_FakeSTT(), tts=fake_tts)

    await worker.speak("hello")

    assert room.published == [b"AUDIO:hello"]


@pytest.mark.asyncio
async def test_say_audio_publishes_raw_audio_directly() -> None:
    room = _FakeRoomClient(frames=[])
    worker = SessionWorker(session_id="sess-5", room_client=room, stt=_FakeSTT())

    await worker.say_audio(b"raw-pcm-bytes")

    assert room.published == [b"raw-pcm-bytes"]


@pytest.mark.asyncio
async def test_leave_disconnects_room_and_closes_stt() -> None:
    room = _FakeRoomClient(frames=[])
    stt = _FakeSTT()
    worker = SessionWorker(session_id="sess-6", room_client=room, stt=stt)

    await worker.join(url="ws://livekit.local", token="tok")
    await worker.leave()

    assert room.disconnected is True
    assert stt.closed is True


@pytest.mark.asyncio
async def test_join_raises_capacity_error_when_guard_has_no_free_slot() -> None:
    guard = SessionConcurrencyGuard(
        max_concurrent_sessions=1, join_timeout_seconds=1.0, acquire_timeout_seconds=0.05
    )
    holding_slot = asyncio.Event()

    async def hold_slot() -> None:
        holding_slot.set()
        await asyncio.sleep(0.3)

    holder_task = asyncio.create_task(guard.run(hold_slot, session_id="holder"))
    await holding_slot.wait()

    worker = SessionWorker(
        session_id="sess-7", room_client=_FakeRoomClient([]), stt=_FakeSTT(), guard=guard
    )

    with pytest.raises(SessionCapacityError):
        await worker.join(url="ws://livekit.local", token="tok")

    await holder_task
