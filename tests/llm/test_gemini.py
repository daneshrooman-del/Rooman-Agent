import asyncio
from dataclasses import dataclass
from typing import Any

import pytest
from pydantic import BaseModel

from trackb.llm.gemini import GeminiLLMProvider, GeminiRequestError


class _Slots(BaseModel):
    purpose: str | None = None


@dataclass
class _FakeResponse:
    text: str | None = None
    parsed: Any = None


class _FakeAioModels:
    def __init__(self, responses: list[Any]) -> None:
        self._responses = responses
        self.calls: list[dict[str, Any]] = []

    async def generate_content(self, *, model: str, contents: Any, config: Any) -> Any:
        self.calls.append({"model": model, "contents": contents, "config": config})
        response = self._responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class _FakeAio:
    def __init__(self, models: _FakeAioModels) -> None:
        self.models = models


class _FakeClient:
    def __init__(self, responses: list[Any]) -> None:
        self.aio = _FakeAio(_FakeAioModels(responses))


def _make_provider(responses: list[Any], **kwargs: Any) -> tuple[GeminiLLMProvider, _FakeClient]:
    client = _FakeClient(responses)
    provider = GeminiLLMProvider(api_key="unused-in-tests", client=client, **kwargs)  # type: ignore[arg-type]
    return provider, client


@pytest.mark.asyncio
async def test_complete_returns_response_text() -> None:
    provider, client = _make_provider([_FakeResponse(text="hello there")])

    result = await provider.complete("say hi")

    assert result == "hello there"
    assert client.aio.models.calls[0]["contents"] == "say hi"


@pytest.mark.asyncio
async def test_extract_returns_the_parsed_schema_instance_directly() -> None:
    slots = _Slots(purpose="an agent that takes HR calls")
    provider, _client = _make_provider([_FakeResponse(text="{}", parsed=slots)])

    result = await provider.extract("extract slots", schema=_Slots)

    assert result is slots


@pytest.mark.asyncio
async def test_extract_validates_a_plain_dict_parsed_result() -> None:
    provider, _client = _make_provider(
        [_FakeResponse(text='{"purpose": "x"}', parsed={"purpose": "x"})]
    )

    result = await provider.extract("extract slots", schema=_Slots)

    assert isinstance(result, _Slots)
    assert result.purpose == "x"


@pytest.mark.asyncio
async def test_extract_raises_clear_error_when_response_is_unparseable() -> None:
    provider, _client = _make_provider([_FakeResponse(text="not json", parsed=None)] * 3)

    with pytest.raises(GeminiRequestError, match="did not return a parseable"):
        await provider.extract("extract slots", schema=_Slots)


@pytest.mark.asyncio
async def test_request_failure_is_retried_and_eventually_succeeds() -> None:
    provider, client = _make_provider(
        [RuntimeError("503 unavailable"), _FakeResponse(text="recovered")]
    )

    result = await provider.complete("say hi")

    assert result == "recovered"
    assert len(client.aio.models.calls) == 2


@pytest.mark.asyncio
async def test_request_failure_exhausts_retries_and_raises_wrapped_error() -> None:
    provider, client = _make_provider([RuntimeError("boom")] * 5)

    with pytest.raises(GeminiRequestError, match="boom"):
        await provider.complete("say hi")

    assert len(client.aio.models.calls) == 3


@pytest.mark.asyncio
async def test_slow_request_times_out_and_raises_wrapped_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import trackb.llm.gemini as gemini_module

    monkeypatch.setattr(gemini_module, "REQUEST_TIMEOUT_SECONDS", 0.05)

    async def _hang(**kwargs: Any) -> Any:
        await asyncio.sleep(10)

    client = _FakeClient([])
    client.aio.models.generate_content = _hang  # type: ignore[method-assign]
    provider = GeminiLLMProvider(api_key="unused", client=client)  # type: ignore[arg-type]

    with pytest.raises(GeminiRequestError, match="timed out"):
        await provider.complete("say hi")


@pytest.mark.asyncio
async def test_system_instruction_and_response_schema_passed_through_for_extract() -> None:
    slots = _Slots(purpose="x")
    provider, client = _make_provider([_FakeResponse(parsed=slots)])

    await provider.extract("extract", schema=_Slots, system="you are an extractor")

    call = client.aio.models.calls[0]
    assert call["config"].system_instruction == "you are an extractor"
    assert call["config"].response_schema is _Slots
    assert call["config"].response_mime_type == "application/json"


@pytest.mark.asyncio
async def test_complete_does_not_set_response_schema() -> None:
    provider, client = _make_provider([_FakeResponse(text="hi")])

    await provider.complete("say hi")

    call = client.aio.models.calls[0]
    assert call["config"].response_schema is None
    assert call["config"].response_mime_type is None
