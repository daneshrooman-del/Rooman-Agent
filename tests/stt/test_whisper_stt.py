import asyncio
import time
from dataclasses import dataclass, field
from typing import Any

import pytest

from trackb.config import Settings
from trackb.stt.errors import TranscriptionError
from trackb.stt.whisper_stt import DEFAULT_SAMPLE_RATE, TranscriptEvent, WhisperSTT


def _pcm16_silence(seconds: float, sample_rate: int = DEFAULT_SAMPLE_RATE) -> bytes:
    return b"\x00\x00" * int(seconds * sample_rate)


@dataclass
class _FakeSegment:
    text: str


@dataclass
class _FakeWhisperModel:
    """Stands in for `faster_whisper.WhisperModel` -- no real model/download involved."""

    responses: list[str | Exception] = field(default_factory=list)
    calls: list[Any] = field(default_factory=list)
    call_kwargs: list[dict[str, Any]] = field(default_factory=list)
    sleep_seconds: float = 0.0

    def transcribe(self, audio: Any, **kwargs: Any) -> tuple[list[_FakeSegment], Any]:
        self.calls.append(audio)
        self.call_kwargs.append(kwargs)
        if self.sleep_seconds:
            time.sleep(self.sleep_seconds)
        if not self.responses:
            return ([_FakeSegment("")], None)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return ([_FakeSegment(response)], None)


def _make_stt(model: _FakeWhisperModel, **kwargs: Any) -> WhisperSTT:
    settings = Settings(whisper_model_size="tiny")
    return WhisperSTT(settings=settings, model=model, chunk_seconds=1.0, **kwargs)


@pytest.mark.asyncio
async def test_push_audio_does_not_transcribe_before_chunk_threshold_reached() -> None:
    model = _FakeWhisperModel(responses=["hello"])
    stt = _make_stt(model)

    await stt.push_audio(_pcm16_silence(0.1))

    assert model.calls == []


@pytest.mark.asyncio
async def test_push_audio_transcribes_once_buffer_reaches_chunk_threshold() -> None:
    model = _FakeWhisperModel(responses=["hello there"])
    stt = _make_stt(model)

    await stt.push_audio(_pcm16_silence(1.5))

    assert len(model.calls) == 1
    events = stt.events()
    event = await anext(events)
    assert event == TranscriptEvent(text="hello there", is_final=False)


@pytest.mark.asyncio
async def test_flush_forces_transcription_of_partial_buffer_as_final() -> None:
    model = _FakeWhisperModel(responses=["a short trailing bit"])
    stt = _make_stt(model)

    await stt.push_audio(_pcm16_silence(0.2))
    assert model.calls == []

    await stt.flush()

    assert len(model.calls) == 1
    event = await anext(stt.events())
    assert event.text == "a short trailing bit"
    assert event.is_final is True


@pytest.mark.asyncio
async def test_empty_transcription_result_yields_no_event() -> None:
    model = _FakeWhisperModel(responses=[""])
    stt = _make_stt(model)

    await stt.push_audio(_pcm16_silence(1.5))

    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(stt.events().__anext__(), timeout=0.2)


@pytest.mark.asyncio
async def test_transient_model_error_is_retried_and_eventually_succeeds() -> None:
    model = _FakeWhisperModel(responses=[RuntimeError("cuda hiccup"), "recovered text"])
    stt = _make_stt(model)

    await stt.push_audio(_pcm16_silence(1.5))

    assert len(model.calls) == 2
    event = await anext(stt.events())
    assert event.text == "recovered text"


@pytest.mark.asyncio
async def test_model_error_exhausts_retries_and_raises_wrapped_error_not_raw() -> None:
    model = _FakeWhisperModel(responses=[RuntimeError("boom")] * 5)
    stt = _make_stt(model, max_attempts=2)

    with pytest.raises(TranscriptionError) as exc_info:
        await stt.push_audio(_pcm16_silence(1.5))

    assert "boom" in str(exc_info.value)
    assert len(model.calls) == 2


@pytest.mark.asyncio
async def test_slow_model_call_times_out_and_raises_transcription_error() -> None:
    model = _FakeWhisperModel(responses=["too slow"], sleep_seconds=0.5)
    stt = _make_stt(model, max_attempts=1, transcribe_timeout_seconds=0.05)

    with pytest.raises(TranscriptionError, match="timed out"):
        await stt.push_audio(_pcm16_silence(1.5))


@pytest.mark.asyncio
async def test_push_audio_after_close_raises() -> None:
    model = _FakeWhisperModel(responses=["hi"])
    stt = _make_stt(model)
    await stt.aclose()

    with pytest.raises(RuntimeError, match="closed"):
        await stt.push_audio(_pcm16_silence(0.1))


@pytest.mark.asyncio
async def test_aclose_flushes_remaining_buffer() -> None:
    model = _FakeWhisperModel(responses=["final words"])
    stt = _make_stt(model)

    await stt.push_audio(_pcm16_silence(0.1))
    await stt.aclose()

    event = await anext(stt.events())
    assert event.text == "final words"
    assert event.is_final is True


@pytest.mark.asyncio
async def test_silence_chunk_after_speech_auto_finalizes_the_utterance() -> None:
    """The turn-detection behavior this whole module exists for: nothing external ever calls
    flush() -- a chunk that comes back silent (vad_filter finds no speech) right after one that
    had real speech is itself what marks the utterance as finished."""
    model = _FakeWhisperModel(responses=["hello there", ""])
    stt = _make_stt(model)

    await stt.push_audio(_pcm16_silence(1.5))  # speech chunk -> interim
    interim = await anext(stt.events())
    assert interim == TranscriptEvent(text="hello there", is_final=False)

    await stt.push_audio(_pcm16_silence(1.5))  # silent chunk -> auto-finalizes
    final = await anext(stt.events())
    assert final == TranscriptEvent(text="hello there", is_final=True)


@pytest.mark.asyncio
async def test_multiple_speech_chunks_accumulate_into_one_utterance_before_finalizing() -> None:
    model = _FakeWhisperModel(responses=["I need an", "agent for HR calls", ""])
    stt = _make_stt(model)

    await stt.push_audio(_pcm16_silence(1.5))
    first = await anext(stt.events())
    assert first == TranscriptEvent(text="I need an", is_final=False)

    await stt.push_audio(_pcm16_silence(1.5))
    second = await anext(stt.events())
    assert second == TranscriptEvent(text="I need an agent for HR calls", is_final=False)

    await stt.push_audio(_pcm16_silence(1.5))  # silence -> finalize the whole accumulated turn
    final = await anext(stt.events())
    assert final == TranscriptEvent(text="I need an agent for HR calls", is_final=True)


@pytest.mark.asyncio
async def test_silence_with_nothing_pending_yields_no_event() -> None:
    """A silent chunk with no prior speech accumulated is just silence, not a turn boundary --
    it must not emit an empty final event."""
    model = _FakeWhisperModel(responses=[""])
    stt = _make_stt(model)

    await stt.push_audio(_pcm16_silence(1.5))

    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(stt.events().__anext__(), timeout=0.2)


@pytest.mark.asyncio
async def test_flush_with_trailing_speech_finalizes_in_one_event_not_two() -> None:
    """Regression guard: an earlier draft of this logic double-emitted -- an interim event
    from transcribing the trailing buffer, then a duplicate final event from finalize -- when
    flush() was called with real speech still sitting in the buffer."""
    model = _FakeWhisperModel(responses=["a short trailing bit"])
    stt = _make_stt(model)

    await stt.push_audio(_pcm16_silence(0.2))  # below chunk threshold, stays buffered
    assert model.calls == []

    await stt.flush()

    assert len(model.calls) == 1
    event = await anext(stt.events())
    assert event == TranscriptEvent(text="a short trailing bit", is_final=True)
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(stt.events().__anext__(), timeout=0.2)


@pytest.mark.asyncio
async def test_vad_filter_is_passed_through_to_the_model() -> None:
    model = _FakeWhisperModel(responses=["hi"])
    stt = _make_stt(model, vad_filter=False)

    await stt.push_audio(_pcm16_silence(1.5))

    assert model.call_kwargs == [{"language": None, "vad_filter": False}]


def test_language_falls_back_to_settings_and_explicit_argument_wins() -> None:
    settings = Settings(whisper_language="en")

    assert WhisperSTT(settings=settings, model=object())._language == "en"  # type: ignore[arg-type]
    assert WhisperSTT(settings=settings, model=object(), language="de")._language == "de"  # type: ignore[arg-type]
    assert WhisperSTT(settings=Settings(), model=object())._language is None  # type: ignore[arg-type]


def test_device_and_compute_type_come_from_settings_unless_overridden() -> None:
    gpu = Settings(whisper_device="cuda", whisper_compute_type="float16")

    stt = WhisperSTT(settings=gpu, model=object())  # type: ignore[arg-type]
    assert (stt._device, stt._compute_type) == ("cuda", "float16")

    cpu = WhisperSTT(settings=Settings(), model=object())  # type: ignore[arg-type]
    assert (cpu._device, cpu._compute_type) == ("cpu", "int8")

    explicit = WhisperSTT(settings=gpu, model=object(), device="cpu", compute_type="int8")  # type: ignore[arg-type]
    assert explicit._device == "cpu"
