import pytest

from trackb.config import Settings
from trackb.session.entrypoint import _UNASSIGNED_AVATAR, _build_tts_provider, _make_tts_fn
from trackb.tts.mock import MockTTSProvider
from trackb.tts.piper_tts import PiperTTSProvider


def test_build_tts_provider_falls_back_to_mock_when_no_voice_model_configured() -> None:
    settings = Settings(tts_voice_model_path="")

    provider = _build_tts_provider(settings)

    assert isinstance(provider, MockTTSProvider)


def test_build_tts_provider_uses_piper_when_voice_model_configured() -> None:
    settings = Settings(tts_voice_model_path="/some/voice.onnx")

    provider = _build_tts_provider(settings)

    assert isinstance(provider, PiperTTSProvider)


@pytest.mark.asyncio
async def test_make_tts_fn_forwards_text_and_closed_over_voice_id_to_provider() -> None:
    provider = MockTTSProvider()

    tts_fn = _make_tts_fn(provider, "voice-42")
    audio = await tts_fn("hello world")

    assert provider.calls == [("hello world", "voice-42")]
    assert isinstance(audio, bytes)


@pytest.mark.asyncio
async def test_make_tts_fn_works_with_no_voice_id() -> None:
    provider = MockTTSProvider()

    tts_fn = _make_tts_fn(provider, None)
    await tts_fn("hi")

    assert provider.calls == [("hi", None)]


@pytest.mark.asyncio
async def test_default_unassigned_voice_id_is_wired_through() -> None:
    provider = MockTTSProvider()

    tts_fn = _make_tts_fn(provider, _UNASSIGNED_AVATAR.voice_id)
    await tts_fn("placeholder voice test")

    assert provider.calls == [("placeholder voice test", "unassigned")]
