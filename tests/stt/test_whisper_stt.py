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
    sleep_seconds: float = 0.0

    def transcribe(self, audio: Any, **kwargs: Any) -> tuple[list[_FakeSegment], Any]:
        self.calls.append(audio)
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
