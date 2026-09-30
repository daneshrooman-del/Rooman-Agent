import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import pytest

from trackb.config import Settings
from trackb.tts.base import TTS_SAMPLE_RATE
from trackb.tts.errors import TTSConfigurationError, TTSSynthesisError
from trackb.tts.piper_tts import PiperTTSProvider, _resample_pcm16


def _pcm16_tone(num_samples: int, amplitude: int = 1000) -> bytes:
    samples = (np.arange(num_samples) % 2 * amplitude).astype(np.int16)
    return samples.tobytes()


@dataclass
class _FakeAudioChunk:
    sample_rate: int
    audio_int16_bytes: bytes


@dataclass
class _FakeVoice:
    """Stands in for `piper.PiperVoice` -- no real model/inference involved."""

    chunks: list[list[_FakeAudioChunk]] = field(default_factory=list)
    calls: list[str] = field(default_factory=list)
    sleep_seconds: float = 0.0
    error: Exception | None = None

    def synthesize(self, text: str, syn_config: Any = None) -> list[_FakeAudioChunk]:
        self.calls.append(text)
        if self.sleep_seconds:
            time.sleep(self.sleep_seconds)
        if self.error is not None:
            raise self.error
        if not self.chunks:
            return []
        return self.chunks.pop(0)


def _make_provider(voice: _FakeVoice, **kwargs: Any) -> PiperTTSProvider:
    return PiperTTSProvider(settings=Settings(), voice=voice, **kwargs)


def test_resample_pcm16_is_a_no_op_when_rates_match() -> None:
    audio = _pcm16_tone(100)

    assert _resample_pcm16(audio, 16_000, 16_000) == audio


def test_resample_pcm16_changes_length_proportionally_to_rate_ratio() -> None:
    audio = _pcm16_tone(22_050)  # 1 second at 22050 Hz

    resampled = _resample_pcm16(audio, 22_050, 16_000)

    resampled_samples = len(resampled) // 2
    assert resampled_samples == pytest.approx(16_000, rel=0.01)


def test_resample_pcm16_handles_empty_input() -> None:
    assert _resample_pcm16(b"", 22_050, 16_000) == b""


@pytest.mark.asyncio
async def test_synthesize_joins_chunks_already_at_target_sample_rate() -> None:
    chunk_a = _FakeAudioChunk(sample_rate=TTS_SAMPLE_RATE, audio_int16_bytes=b"\x01\x00\x02\x00")
    chunk_b = _FakeAudioChunk(sample_rate=TTS_SAMPLE_RATE, audio_int16_bytes=b"\x03\x00\x04\x00")
    voice = _FakeVoice(chunks=[[chunk_a, chunk_b]])
    provider = _make_provider(voice)

    audio = await provider.synthesize("hello there")

    assert audio == b"\x01\x00\x02\x00\x03\x00\x04\x00"
    assert voice.calls == ["hello there"]


@pytest.mark.asyncio
async def test_synthesize_resamples_chunks_not_at_target_sample_rate() -> None:
    native_rate = 22_050
    chunk = _FakeAudioChunk(
        sample_rate=native_rate, audio_int16_bytes=_pcm16_tone(native_rate)
    )
    voice = _FakeVoice(chunks=[[chunk]])
    provider = _make_provider(voice)

    audio = await provider.synthesize("hello")

    assert len(audio) // 2 == pytest.approx(TTS_SAMPLE_RATE, rel=0.01)


@pytest.mark.asyncio
async def test_synthesize_empty_text_returns_empty_bytes_without_calling_voice() -> None:
    voice = _FakeVoice()
    provider = _make_provider(voice)

    audio = await provider.synthesize("   ")

    assert audio == b""
    assert voice.calls == []


@pytest.mark.asyncio
async def test_synthesize_ignores_voice_id_without_raising() -> None:
    chunk = _FakeAudioChunk(sample_rate=TTS_SAMPLE_RATE, audio_int16_bytes=b"\x01\x00")
    voice = _FakeVoice(chunks=[[chunk]])
    provider = _make_provider(voice)

    audio = await provider.synthesize("hi", voice_id="some-voice")

    assert audio == b"\x01\x00"


@pytest.mark.asyncio
async def test_synthesize_wraps_model_error_as_tts_synthesis_error() -> None:
    voice = _FakeVoice(error=RuntimeError("onnxruntime blew up"))
    provider = _make_provider(voice)

    with pytest.raises(TTSSynthesisError, match="onnxruntime blew up"):
        await provider.synthesize("hello")


@pytest.mark.asyncio
async def test_synthesize_times_out_and_raises_tts_synthesis_error() -> None:
    voice = _FakeVoice(chunks=[[]], sleep_seconds=0.5)
    provider = _make_provider(voice, synthesis_timeout_seconds=0.05)

    with pytest.raises(TTSSynthesisError, match="timed out"):
        await provider.synthesize("slow text")


@pytest.mark.asyncio
async def test_synthesize_raises_configuration_error_when_no_model_path_configured() -> None:
    provider = PiperTTSProvider(settings=Settings(tts_voice_model_path=""))

    with pytest.raises(TTSConfigurationError, match="TRACKB_TTS_VOICE_MODEL_PATH"):
        await provider.synthesize("hello")


@pytest.mark.asyncio
async def test_synthesize_raises_configuration_error_when_model_file_missing(
    tmp_path: Path,
) -> None:
    missing_path = tmp_path / "does-not-exist.onnx"
    provider = PiperTTSProvider(settings=Settings(tts_voice_model_path=str(missing_path)))

    with pytest.raises(TTSConfigurationError, match="not found"):
        await provider.synthesize("hello")
