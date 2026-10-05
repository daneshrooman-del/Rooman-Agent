"""`LLMProvider` backed by a local (or remote) Ollama server -- free, no per-token cost.

Talks to Ollama's native `/api/chat` over HTTP (`httpx`), so `base_url` can be the local
machine (`http://localhost:11434`) or, later, an Ollama running on the Kaggle GPU. Nothing here
imports an Ollama SDK.

- `complete()` -- one non-streaming chat call.
- `stream()` -- NDJSON deltas, one `{"message": {"content": ...}, "done": bool}` per line.
- `extract()` -- Ollama's structured outputs: the pydantic model's JSON schema goes in `format`
  and the reply is validated against it. Small models occasionally still produce invalid JSON,
  so a validation failure is retried (bounded) before giving up.

`keep_alive` keeps the model resident between turns; a cold model load can cost several seconds,
which would blow the latency budget on the first reply of a session.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any, TypeVar

import httpx
import structlog
from pydantic import BaseModel, ValidationError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

logger = structlog.get_logger(__name__)

SchemaT = TypeVar("SchemaT", bound=BaseModel)

DEFAULT_BASE_URL = "http://localhost:11434"
DEFAULT_MODEL = "qwen2.5:3b"
CONNECT_TIMEOUT_SECONDS = 5.0
REQUEST_TIMEOUT_SECONDS = 60.0
"""Local CPU inference is far slower than a hosted API, so this is generous on purpose."""
STREAM_CHUNK_TIMEOUT_SECONDS = 30.0
EXTRACT_MAX_ATTEMPTS = 3


class OllamaRequestError(Exception):
    """Raised when Ollama is unreachable, errors, or returns output that can't be used."""


class _InvalidStructuredOutput(OllamaRequestError):
    """The model replied, but not with JSON matching the requested schema (retryable)."""


_NETWORK_RETRY = retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=4),
    retry=retry_if_exception_type(httpx.TransportError),
    reraise=True,
)


class OllamaLLMProvider:
    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        base_url: str = DEFAULT_BASE_URL,
        *,
        keep_alive: str = "30m",
        temperature: float = 0.6,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._model = model
        self._keep_alive = keep_alive
        self._temperature = temperature
        self._client = client or httpx.AsyncClient(
            base_url=base_url,
            timeout=httpx.Timeout(REQUEST_TIMEOUT_SECONDS, connect=CONNECT_TIMEOUT_SECONDS),
        )

    def _payload(
        self, prompt: str, system: str | None, *, stream: bool, schema: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "stream": stream,
            "keep_alive": self._keep_alive,
            "options": {"temperature": self._temperature},
        }
        if schema is not None:
            payload["format"] = schema
        return payload

    async def complete(self, prompt: str, system: str | None = None) -> str:
        data = await self._post_chat(self._payload(prompt, system, stream=False))
        return str(data.get("message", {}).get("content", ""))

    async def extract(
        self, prompt: str, schema: type[SchemaT], system: str | None = None
    ) -> SchemaT:
        payload = self._payload(
            prompt, system, stream=False, schema=schema.model_json_schema()
        )
        last_error: Exception | None = None
        for attempt in range(1, EXTRACT_MAX_ATTEMPTS + 1):
            data = await self._post_chat(payload)
            content = str(data.get("message", {}).get("content", ""))
            try:
                return schema.model_validate_json(content)
            except ValidationError as exc:
                last_error = exc
                logger.warning(
                    "ollama_extract_invalid_output", attempt=attempt, schema=schema.__name__
                )
        raise _InvalidStructuredOutput(
            f"Ollama did not return a valid {schema.__name__} after "
            f"{EXTRACT_MAX_ATTEMPTS} attempts: {last_error}"
        )

    async def stream(self, prompt: str, system: str | None = None) -> AsyncIterator[str]:
        payload = self._payload(prompt, system, stream=True)
        try:
            async with self._client.stream("POST", "/api/chat", json=payload) as response:
                await self._raise_for_status(response)
                lines = response.aiter_lines().__aiter__()
                while True:
                    try:
                        line = await _with_timeout(lines.__anext__(), STREAM_CHUNK_TIMEOUT_SECONDS)
                    except StopAsyncIteration:
                        return
                    if not line.strip():
                        continue
                    chunk = json.loads(line)
                    if "error" in chunk:
                        raise OllamaRequestError(f"Ollama stream error: {chunk['error']}")
                    text = chunk.get("message", {}).get("content", "")
                    if text:
                        yield text
                    if chunk.get("done"):
                        return
        except httpx.HTTPError as exc:
            raise OllamaRequestError(f"Ollama stream failed: {exc!r}") from exc
        except json.JSONDecodeError as exc:
            raise OllamaRequestError(f"Ollama sent a malformed stream line: {exc}") from exc

    async def warm_up(self) -> None:
        """Load the model into memory now (empty prompt), so the first real turn isn't cold."""
        await self._post_chat(
            {"model": self._model, "messages": [], "keep_alive": self._keep_alive, "stream": False}
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    @_NETWORK_RETRY
    async def _post_chat(self, payload: dict[str, Any]) -> dict[str, Any]:
        response = await self._client.post("/api/chat", json=payload)
        await self._raise_for_status(response)
        result: dict[str, Any] = response.json()
        return result

    @staticmethod
    async def _raise_for_status(response: httpx.Response) -> None:
        if response.is_success:
            return
        await response.aread()
        raise OllamaRequestError(
            f"Ollama returned HTTP {response.status_code}: {response.text[:300]}"
        )


async def _with_timeout(awaitable: Any, seconds: float) -> Any:
    try:
        return await asyncio.wait_for(awaitable, timeout=seconds)
    except asyncio.TimeoutError as exc:
        raise OllamaRequestError(f"Ollama stream stalled for {seconds}s") from exc
