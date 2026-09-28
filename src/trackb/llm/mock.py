"""A deterministic, canned-response LLM provider for unit tests and local dev.

Real backends (whichever gets chosen outside this track) implement the same
`LLMProvider` protocol and are swapped in via config -- nothing that depends on
LLMProvider needs to change.
"""

from collections.abc import Callable
from typing import TypeVar

from pydantic import BaseModel

SchemaT = TypeVar("SchemaT", bound=BaseModel)

ExtractFn = Callable[[str, type[BaseModel]], BaseModel]


class MockLLMProvider:
    def __init__(
        self,
        complete_fn: Callable[[str], str] | None = None,
        extract_fn: ExtractFn | None = None,
    ) -> None:
        self._complete_fn = complete_fn or (lambda prompt: f"echo: {prompt}")
        self._extract_fn = extract_fn

    async def complete(self, prompt: str, system: str | None = None) -> str:
        return self._complete_fn(prompt)

    async def extract(self, prompt: str, schema: type[SchemaT], system: str | None = None) -> SchemaT:
        if self._extract_fn is None:
            raise NotImplementedError(
                "MockLLMProvider was not given extract_fn -- pass one that returns "
                f"an instance of {schema.__name__} for this test"
            )
        result = self._extract_fn(prompt, schema)
        return schema.model_validate(result)
