"""`LLMProvider` backed by Google's Gemini API (`google-genai` SDK).

Confirmed against the installed `google-genai` package (2.25.0) via direct inspection, not
guessed: `genai.Client(api_key=...)` exposes an async surface at `client.aio.models` --
`generate_content(model=..., contents=..., config=types.GenerateContentConfig(...))` is a real
coroutine, so this needs no `asyncio.to_thread` wrapper the way a sync-only SDK would.
Structured extraction uses `GenerateContentConfig(response_mime_type="application/json",
response_schema=<a pydantic BaseModel class>)`; the parsed result comes back on
`response.parsed` as an instance of that same class (or occasionally a plain `dict` matching
its shape -- both are handled). `response.text` gives the raw text for a plain completion.
"""

from __future__ import annotations

import asyncio
from typing import TypeVar

import structlog
from google import genai
from google.genai import types
from pydantic import BaseModel
from tenacity import retry, stop_after_attempt, wait_exponential

logger = structlog.get_logger(__name__)

SchemaT = TypeVar("SchemaT", bound=BaseModel)

DEFAULT_MODEL = "gemini-flash-latest"
REQUEST_TIMEOUT_SECONDS = 20.0

_RETRY = retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=4),
    reraise=True,
)


class GeminiRequestError(Exception):
    """Raised when a Gemini request fails (timeout, API error) or returns a structured
    response that doesn't actually match the schema that was asked for."""


class GeminiLLMProvider:
    """Real network calls -- every request is wrapped with a timeout and a bounded retry,
    per this project's convention for external calls."""

    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_MODEL,
        client: genai.Client | None = None,
    ) -> None:
        self._model = model
        self._client = client or genai.Client(api_key=api_key)

    async def complete(self, prompt: str, system: str | None = None) -> str:
        response = await self._generate(prompt, system=system)
        return response.text or ""

    async def extract(
        self, prompt: str, schema: type[SchemaT], system: str | None = None
    ) -> SchemaT:
        response = await self._generate(prompt, system=system, response_schema=schema)
        parsed = response.parsed
        if isinstance(parsed, schema):
            return parsed
        if isinstance(parsed, dict):
            return schema.model_validate(parsed)
        raise GeminiRequestError(
            f"Gemini did not return a parseable {schema.__name__} for this prompt "
            f"(raw text: {response.text!r})"
        )

    @_RETRY
    async def _generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        response_schema: type[BaseModel] | None = None,
    ) -> types.GenerateContentResponse:
        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json" if response_schema else None,
            response_schema=response_schema,
        )
        try:
            return await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model=self._model, contents=prompt, config=config
                ),
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as exc:
            raise GeminiRequestError(
                f"Gemini request timed out after {REQUEST_TIMEOUT_SECONDS}s"
            ) from exc
        except GeminiRequestError:
            raise
        except Exception as exc:
            raise GeminiRequestError(f"Gemini request failed: {exc}") from exc
