"""LLM abstraction.

The concrete LLM/hosting choice is being decided outside this track. Nothing else in
this codebase may import a specific vendor SDK directly -- everything goes through
LLMProvider so swapping the backend later is a config change, not a rewrite.
"""

from collections.abc import AsyncIterator
from typing import Protocol, TypeVar, runtime_checkable

from pydantic import BaseModel

SchemaT = TypeVar("SchemaT", bound=BaseModel)


class LLMProvider(Protocol):
    async def complete(self, prompt: str, system: str | None = None) -> str:
        """Free-form text completion."""
        ...

    async def extract(
        self, prompt: str, schema: type[SchemaT], system: str | None = None
    ) -> SchemaT:
        """Structured extraction: the response is validated against `schema` before returning."""
        ...


@runtime_checkable
class StreamingLLMProvider(LLMProvider, Protocol):
    """An `LLMProvider` that can also yield a free-form reply incrementally.

    Kept as a separate protocol so existing providers and fakes that only implement
    `complete`/`extract` stay valid. Structured `extract()` calls (intake, flow engine) are not
    streamed -- a partial JSON object is not speakable.
    """

    def stream(self, prompt: str, system: str | None = None) -> AsyncIterator[str]:
        """Yield text deltas as the model produces them."""
        ...
