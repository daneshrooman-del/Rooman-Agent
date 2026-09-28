import pytest

from trackb.tts.base import TTS_SAMPLE_RATE
from trackb.tts.mock import DEFAULT_SILENCE_SECONDS, MockTTSProvider

_BYTES_PER_SAMPLE = 2


def test_mock_provider_exposes_the_tts_provider_shape() -> None:
    provider = MockTTSProvider()

    assert hasattr(provider, "synthesize")
    assert callable(provider.synthesize)


@pytest.mark.asyncio
async def test_default_mock_provider_returns_fixed_silence_of_expected_length() -> None:
    provider = MockTTSProvider()

    audio = await provider.synthesize("hello there")

    expected_length = _BYTES_PER_SAMPLE * int(DEFAULT_SILENCE_SECONDS * TTS_SAMPLE_RATE)
    assert len(audio) == expected_length
    assert audio == b"\x00" * expected_length


@pytest.mark.asyncio
async def test_mock_provider_is_deterministic_across_calls() -> None:
    provider = MockTTSProvider()

    first = await provider.synthesize("some text")
    second = await provider.synthesize("some text")

    assert first == second


@pytest.mark.asyncio
async def test_mock_provider_records_calls_with_text_and_voice_id() -> None:
    provider = MockTTSProvider()

    await provider.synthesize("hi", voice_id="voice-1")
    await provider.synthesize("bye")

    assert provider.calls == [("hi", "voice-1"), ("bye", None)]


@pytest.mark.asyncio
async def test_mock_provider_uses_injected_synthesize_fn() -> None:
    def _fn(text: str, voice_id: str | None) -> bytes:
        return f"{voice_id}:{text}".encode()

    provider = MockTTSProvider(synthesize_fn=_fn)

    audio = await provider.synthesize("say this", voice_id="voice-9")

    assert audio == b"voice-9:say this"


@pytest.mark.asyncio
async def test_mock_provider_silence_seconds_is_configurable() -> None:
    provider = MockTTSProvider(silence_seconds=0.5)

    audio = await provider.synthesize("x")

    assert len(audio) == _BYTES_PER_SAMPLE * int(0.5 * TTS_SAMPLE_RATE)
