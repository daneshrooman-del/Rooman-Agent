import pytest

from trackb.config import Settings
from trackb.llm.factory import build_llm_provider
from trackb.llm.gemini import GeminiLLMProvider
from trackb.llm.mock import MockLLMProvider


def test_defaults_to_mock_provider() -> None:
    settings = Settings(llm_provider="mock")

    provider = build_llm_provider(settings)

    assert isinstance(provider, MockLLMProvider)


def test_builds_gemini_provider_when_configured() -> None:
    settings = Settings(llm_provider="gemini", gemini_api_key="fake-key", gemini_model="m")

    provider = build_llm_provider(settings)

    assert isinstance(provider, GeminiLLMProvider)


def test_gemini_without_api_key_raises_a_clear_error() -> None:
    settings = Settings(llm_provider="gemini", gemini_api_key="")

    with pytest.raises(ValueError, match="TRACKB_GEMINI_API_KEY"):
        build_llm_provider(settings)
