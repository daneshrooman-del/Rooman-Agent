"""LLM abstraction.

The concrete LLM/hosting choice is being decided outside this track. Nothing else in
this codebase may import a specific vendor SDK directly -- everything goes through
LLMProvider so swapping the backend later is a config change, not a rewrite.
"""

from typing import Protocol, TypeVar

from pydantic import BaseModel

SchemaT = TypeVar("SchemaT", bound=BaseModel)


class LLMProvider(Protocol):
    async def complete(self, prompt: str, system: str | None = None) -> str:
        """Free-form text completion."""
        ...

    async def extract(self, prompt: str, schema: type[SchemaT], system: str | None = None) -> SchemaT:
        """Structured extraction: the response is validated against `schema` before returning."""
        ...
