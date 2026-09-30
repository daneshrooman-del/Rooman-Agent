"""Builds the configured `LLMProvider` from `Settings`.

The rest of this codebase depends only on the `LLMProvider` protocol -- nothing else imports
a specific backend. This is the one place that reads `Settings.llm_provider` and picks a
concrete implementation, so swapping the backend is a config change, not a code change.
"""

from __future__ import annotations

from trackb.config import Settings, get_settings
from trackb.llm.base import LLMProvider
from trackb.llm.mock import MockLLMProvider


def build_llm_provider(settings: Settings | None = None) -> LLMProvider:
    settings = settings or get_settings()

    if settings.llm_provider == "gemini":
        if not settings.gemini_api_key:
            raise ValueError(
                "TRACKB_LLM_PROVIDER=gemini requires TRACKB_GEMINI_API_KEY to be set"
            )
        from trackb.llm.gemini import GeminiLLMProvider

        return GeminiLLMProvider(api_key=settings.gemini_api_key, model=settings.gemini_model)

    return MockLLMProvider()
