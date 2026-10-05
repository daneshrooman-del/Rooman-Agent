import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable

import pytest

from trackb.session.concurrency import SessionConcurrencyGuard
from trackb.session.errors import SessionCapacityError
from trackb.session.worker import SessionWorker, TranscribedUtterance
from trackb.stt.whisper_stt import TranscriptEvent


class _FakeRoomClient:
    def __init__(
        self,
        frames: list[bytes],
        *,
        local_identity: str = "agent-local",
        remote_identity: str | None = "caller-1",
        remote_track_sid: str | None = "TR_mic",
        fail_publish_transcription: bool = False,
    ) -> None:
        self._frames = frames
        self.connect_calls: list[tuple[str, str]] = []
        self.published: list[bytes] = []
        self.disconnected = False
        self._stop = asyncio.Event()

        self.local_identity = local_identity
        self.local_track_sid: str | None = None
        self.remote_identity = remote_identity
        self.remote_track_sid = remote_track_sid
        self._fail_publish_transcription = fail_publish_transcription
        self.published_transcriptions: list[dict[str, object]] = []
        self.text_handler: Callable[[str], Awaitable[None]] | None = None

    async def connect(self, *, url: str, token: str) -> None:
        self.connect_calls.append((url, token))

    async def audio_frames(self) -> AsyncIterator[bytes]:
        for frame in self._frames:
            yield frame
        await self._stop.wait()

    async def publish_audio(self, audio: bytes) -> None:
        self.published.append(audio)
        self.local_track_sid = "TR_local_0"

    async def disconnect(self) -> None:
        self.disconnected = True
        self._stop.set()

    async def publish_transcription(
        self,
        *,
        participant_identity: str,
        track_sid: str,
        segment_id: str,
        text: str,
        final: bool,
    ) -> None:
        if self._fail_publish_transcription:
            raise RuntimeError("simulated transcription publish failure")
        self.published_transcriptions.append(
            {
                "participant_identity": participant_identity,
                "track_sid": track_sid,
                "segment_id": segment_id,
                "text": text,
                "final": final,
            }
        )

    def on_text_message(self, handler: Callable[[str], Awaitable[None]]) -> None:
        self.text_handler = handler


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


class _FailingAudioRoomClient(_FakeRoomClient):
    """A room client whose `audio_frames()` fails outright, e.g. simulating
    `LiveKitRoomClient` timing out waiting for a remote participant to ever join."""

    def __init__(self, error: Exception) -> None:
        super().__init__(frames=[])
        self._error = error

    async def audio_frames(self) -> AsyncIterator[bytes]:
        raise self._error
        yield b""  # pragma: no cover -- unreachable; keeps this an async generator


@pytest.mark.asyncio
async def test_audio_pump_failure_forces_a_full_leave_instead_of_a_silent_zombie() -> None:
    """Regression test found via a real manual run against a live LiveKit server:
    `audio_frames()` failing (e.g. a participant-wait timeout) used to just log an error and
    let its task die -- the session stayed "joined" forever, its transcript pump running
    against an STT that would never receive anything again, and nothing ever called leave().
    A failed pump task must now force a full leave() on its own."""
    room = _FailingAudioRoomClient(TimeoutError("no participant joined in time"))
    stt = _FakeSTT()
    worker = SessionWorker(session_id="sess-8", room_client=room, stt=stt)

    await worker.join(url="ws://livekit.local", token="tok")
    await asyncio.sleep(0.1)

    assert room.disconnected is True
    assert stt.closed is True


@pytest.mark.asyncio
async def test_interim_and_final_utterances_both_publish_caller_transcription() -> None:
    room = _FakeRoomClient(frames=[])
    stt = _FakeSTT()
    worker = SessionWorker(session_id="sess-10", room_client=room, stt=stt)

    await worker.join(url="ws://livekit.local", token="tok")

    await stt.emit(TranscriptEvent(text="hello", is_final=False))
    await stt.emit(TranscriptEvent(text="hello world", is_final=True))
    await asyncio.sleep(0.1)

    assert [
        (entry["participant_identity"], entry["text"], entry["final"])
        for entry in room.published_transcriptions
    ] == [
        ("caller-1", "hello", False),
        ("caller-1", "hello world", True),
    ]
    assert room.published_transcriptions[0]["track_sid"] == "TR_mic"
    # Each segment gets its own id.
    assert (
        room.published_transcriptions[0]["segment_id"]
        != room.published_transcriptions[1]["segment_id"]
    )

    await worker.leave()


@pytest.mark.asyncio
async def test_caller_transcription_publish_skipped_when_remote_identity_unknown() -> None:
    room = _FakeRoomClient(frames=[], remote_identity=None, remote_track_sid=None)
    stt = _FakeSTT()
    worker = SessionWorker(session_id="sess-11", room_client=room, stt=stt)

    await worker.join(url="ws://livekit.local", token="tok")
    await stt.emit(TranscriptEvent(text="hello", is_final=True))
    await asyncio.sleep(0.1)

    assert room.published_transcriptions == []

    await worker.leave()


@pytest.mark.asyncio
async def test_speak_publishes_agent_transcription_with_local_identity() -> None:
    room = _FakeRoomClient(frames=[])

    async def fake_tts(text: str) -> bytes:
        return f"AUDIO:{text}".encode()

    worker = SessionWorker(session_id="sess-12", room_client=room, stt=_FakeSTT(), tts=fake_tts)

    await worker.speak("hello there")

    assert room.published == [b"AUDIO:hello there"]
    interim, entry = room.published_transcriptions  # grows per sentence, then final
    assert interim["final"] is False
    assert interim["segment_id"] == entry["segment_id"]
    assert entry["participant_identity"] == "agent-local"
    assert entry["track_sid"] == "TR_local_0"
    assert entry["text"] == "hello there"
    assert entry["final"] is True


@pytest.mark.asyncio
async def test_say_audio_without_text_does_not_publish_transcription() -> None:
    room = _FakeRoomClient(frames=[])
    worker = SessionWorker(session_id="sess-13", room_client=room, stt=_FakeSTT())

    await worker.say_audio(b"raw-pcm-bytes")

    assert room.published == [b"raw-pcm-bytes"]
    assert room.published_transcriptions == []


@pytest.mark.asyncio
async def test_caller_transcription_publish_failure_is_logged_not_raised() -> None:
    room = _FakeRoomClient(frames=[], fail_publish_transcription=True)
    stt = _FakeSTT()
    received: list[TranscribedUtterance] = []

    async def handler(utterance: TranscribedUtterance) -> None:
        received.append(utterance)

    worker = SessionWorker(session_id="sess-14", room_client=room, stt=stt)
    worker.on_utterance(handler)

    await worker.join(url="ws://livekit.local", token="tok")
    await stt.emit(TranscriptEvent(text="hello world", is_final=True))
    await asyncio.sleep(0.1)

    # The handler still ran, and the session is still alive -- the failed transcription publish
    # didn't take the whole session down with it.
    assert [u.text for u in received] == ["hello world"]
    assert worker._joined is True  # noqa: SLF001 -- verifying the session wasn't force-left

    await worker.leave()


@pytest.mark.asyncio
async def test_agent_transcription_publish_failure_is_logged_not_raised() -> None:
    room = _FakeRoomClient(frames=[], fail_publish_transcription=True)

    async def fake_tts(text: str) -> bytes:
        return f"AUDIO:{text}".encode()

    worker = SessionWorker(session_id="sess-15", room_client=room, stt=_FakeSTT(), tts=fake_tts)

    await worker.speak("hello there")

    # speak() completed without raising, and the audio was still published.
    assert room.published == [b"AUDIO:hello there"]


@pytest.mark.asyncio
async def test_leave_is_idempotent() -> None:
    room = _FakeRoomClient(frames=[])
    stt = _FakeSTT()
    worker = SessionWorker(session_id="sess-9", room_client=room, stt=stt)

    await worker.join(url="ws://livekit.local", token="tok")
    await worker.leave()
    await worker.leave()

    assert room.disconnected is True
    assert stt.closed is True


@pytest.mark.asyncio
async def test_typed_text_reaches_the_same_utterance_handler_as_speech() -> None:
    """A user who types instead of speaks must drive the conversation identically -- no
    changes needed in IntakeSessionDriver/ConversationSessionDriver, which only ever react to
    TranscribedUtterance regardless of where it came from."""
    room = _FakeRoomClient(frames=[])
    worker = SessionWorker(session_id="sess-10", room_client=room, stt=_FakeSTT())
    received: list[TranscribedUtterance] = []

    async def handler(utterance: TranscribedUtterance) -> None:
        received.append(utterance)

    worker.on_utterance(handler)
    await worker.join(url="ws://livekit.local", token="tok")

    assert room.text_handler is not None
    await room.text_handler("I need an agent for HR calls")

    assert len(received) == 1
    assert received[0] == TranscribedUtterance(
        session_id="sess-10", text="I need an agent for HR calls", is_final=True
    )

    await worker.leave()


@pytest.mark.asyncio
async def test_typed_text_is_not_echoed_back_as_a_transcription() -> None:
    """The frontend already appends the user's own typed message to its transcript
    optimistically before this even reaches the backend -- publishing a transcription for it
    too would duplicate the line."""
    room = _FakeRoomClient(frames=[])
    worker = SessionWorker(session_id="sess-11", room_client=room, stt=_FakeSTT())
    worker.on_utterance(lambda _utterance: asyncio.sleep(0))

    await worker.join(url="ws://livekit.local", token="tok")
    assert room.text_handler is not None
    await room.text_handler("hello")

    assert room.published_transcriptions == []

    await worker.leave()


async def _sentences(*items: str) -> AsyncIterator[str]:
    for item in items:
        yield item


@pytest.mark.asyncio
async def test_speak_stream_publishes_each_sentence_in_order_with_transcripts() -> None:
    room = _FakeRoomClient(frames=[])

    async def fake_tts(text: str) -> bytes:
        return f"A:{text}".encode()

    worker = SessionWorker(session_id="s-st1", room_client=room, stt=_FakeSTT(), tts=fake_tts)

    await worker.speak_stream(_sentences("One.", "Two.", "Three."))

    assert room.published == [b"A:One.", b"A:Two.", b"A:Three."]
    # One transcript line per reply, growing as each sentence's audio goes out, then final.
    segments = room.published_transcriptions
    assert [(t["text"], t["final"]) for t in segments] == [
        ("One.", False),
        ("One. Two.", False),
        ("One. Two. Three.", False),
        ("One. Two. Three.", True),
    ]
    assert len({t["segment_id"] for t in segments}) == 1


@pytest.mark.asyncio
async def test_speak_stream_synthesizes_next_sentence_while_publishing_current() -> None:
    room = _FakeRoomClient(frames=[])
    events: list[str] = []
    publish_gate = asyncio.Event()

    async def fake_tts(text: str) -> bytes:
        events.append(f"tts:{text}")
        return text.encode()

    original = room.publish_audio

    async def slow_publish(audio: bytes) -> None:
        events.append(f"pub-start:{audio.decode()}")
        if audio == b"A":
            await publish_gate.wait()
        await original(audio)

    room.publish_audio = slow_publish  # type: ignore[method-assign]
    worker = SessionWorker(session_id="s-st2", room_client=room, stt=_FakeSTT(), tts=fake_tts)

    task = asyncio.create_task(worker.speak_stream(_sentences("A", "B")))
    for _ in range(20):
        await asyncio.sleep(0)
    # B is synthesized while A's publish is still blocked (relative order of the two is free)
    assert events[0] == "tts:A"
    assert set(events) == {"tts:A", "pub-start:A", "tts:B"}
    assert room.published == []
    publish_gate.set()
    await task

    assert room.published == [b"A", b"B"]


@pytest.mark.asyncio
async def test_speak_stream_cancellation_stops_producer_and_closes_source() -> None:
    room = _FakeRoomClient(frames=[])
    closed = asyncio.Event()

    async def endless() -> AsyncIterator[str]:
        try:
            i = 0
            while True:
                yield f"s{i}"
                i += 1
                await asyncio.sleep(0)
        finally:
            closed.set()

    async def fake_tts(text: str) -> bytes:
        return text.encode()

    async def blocked_publish(audio: bytes) -> None:
        await asyncio.Event().wait()

    room.publish_audio = blocked_publish  # type: ignore[method-assign]
    worker = SessionWorker(session_id="s-st3", room_client=room, stt=_FakeSTT(), tts=fake_tts)

    task = asyncio.create_task(worker.speak_stream(endless()))
    await asyncio.sleep(0.01)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    assert closed.is_set()


@pytest.mark.asyncio
async def test_speak_stream_propagates_tts_failure() -> None:
    room = _FakeRoomClient(frames=[])

    async def bad_tts(text: str) -> bytes:
        raise RuntimeError("synth down")

    worker = SessionWorker(session_id="s-st4", room_client=room, stt=_FakeSTT(), tts=bad_tts)

    with pytest.raises(RuntimeError, match="synth down"):
        await worker.speak_stream(_sentences("hello there"))
    assert room.published == []


@pytest.mark.asyncio
async def test_speak_stream_without_tts_raises() -> None:
    worker = SessionWorker(
        session_id="s-st5", room_client=_FakeRoomClient(frames=[]), stt=_FakeSTT()
    )
    with pytest.raises(NotImplementedError, match="tts"):
        await worker.speak_stream(_sentences("x"))


@pytest.mark.asyncio
async def test_speak_splits_multi_sentence_text_into_pipelined_clips() -> None:
    room = _FakeRoomClient(frames=[])

    async def fake_tts(text: str) -> bytes:
        return text.encode()

    worker = SessionWorker(session_id="s-sp", room_client=room, stt=_FakeSTT(), tts=fake_tts)

    await worker.speak("Thanks for that detail. What should the agent do first?")

    assert room.published == [b"Thanks for that detail.", b"What should the agent do first?"]
    assert room.published_transcriptions[-1]["text"] == (
        "Thanks for that detail. What should the agent do first?"
    )
