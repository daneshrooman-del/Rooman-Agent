import json
from collections.abc import Callable

import httpx
import pytest
from pydantic import BaseModel

from trackb.llm.base import StreamingLLMProvider
from trackb.llm.ollama import OllamaLLMProvider, OllamaRequestError


class _Slots(BaseModel):
    purpose: str


def _provider(handler: Callable[[httpx.Request], httpx.Response]) -> OllamaLLMProvider:
    client = httpx.AsyncClient(
        base_url="http://ollama.test", transport=httpx.MockTransport(handler)
    )
    return OllamaLLMProvider(model="m", client=client)


def _reply(content: str) -> httpx.Response:
    return httpx.Response(200, json={"message": {"role": "assistant", "content": content}})


@pytest.mark.asyncio
async def test_complete_sends_system_and_user_messages_and_returns_content() -> None:
    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return _reply("hello")

    result = await _provider(handler).complete("hi", system="be brief")

    assert result == "hello"
    body = seen[0]
    assert body["model"] == "m" and body["stream"] is False and body["keep_alive"] == "30m"
    assert body["messages"] == [
        {"role": "system", "content": "be brief"},
        {"role": "user", "content": "hi"},
    ]


@pytest.mark.asyncio
async def test_extract_sends_schema_and_validates_reply() -> None:
    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return _reply('{"purpose": "sell shoes"}')

    result = await _provider(handler).extract("go", _Slots)

    assert result == _Slots(purpose="sell shoes")
    assert seen[0]["format"] == _Slots.model_json_schema()


@pytest.mark.asyncio
async def test_extract_retries_invalid_json_then_succeeds() -> None:
    replies = iter(["not json", '{"wrong": 1}', '{"purpose": "ok"}'])

    result = await _provider(lambda r: _reply(next(replies))).extract("go", _Slots)

    assert result.purpose == "ok"


@pytest.mark.asyncio
async def test_extract_gives_up_after_bounded_attempts() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return _reply("garbage")

    with pytest.raises(OllamaRequestError, match="valid _Slots"):
        await _provider(handler).extract("go", _Slots)
    assert calls == 3


@pytest.mark.asyncio
async def test_http_error_becomes_ollama_request_error() -> None:
    provider = _provider(lambda r: httpx.Response(404, text="model 'm' not found"))

    with pytest.raises(OllamaRequestError, match="404.*not found"):
        await provider.complete("hi")


@pytest.mark.asyncio
async def test_stream_yields_ndjson_deltas_until_done() -> None:
    lines = [
        {"message": {"content": "Hel"}, "done": False},
        {"message": {"content": ""}, "done": False},
        {"message": {"content": "lo."}, "done": False},
        {"message": {"content": ""}, "done": True},
    ]
    body = "\n".join(json.dumps(line) for line in lines) + "\n"
    provider = _provider(lambda r: httpx.Response(200, text=body))

    assert [t async for t in provider.stream("hi")] == ["Hel", "lo."]
    assert isinstance(provider, StreamingLLMProvider)


@pytest.mark.asyncio
async def test_stream_error_line_and_http_error_raise() -> None:
    err_body = json.dumps({"error": "out of memory"}) + "\n"
    with pytest.raises(OllamaRequestError, match="out of memory"):
        _ = [t async for t in _provider(lambda r: httpx.Response(200, text=err_body)).stream("x")]

    with pytest.raises(OllamaRequestError, match="500"):
        _ = [t async for t in _provider(lambda r: httpx.Response(500, text="x")).stream("x")]


@pytest.mark.asyncio
async def test_unreachable_server_is_retried_then_raises_transport_error() -> None:
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise httpx.ConnectError("refused")

    with pytest.raises(httpx.ConnectError):
        await _provider(handler).complete("hi")
    assert attempts == 3


@pytest.mark.asyncio
async def test_warm_up_sends_empty_messages_request() -> None:
    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"done": True})

    await _provider(handler).warm_up()

    assert seen[0]["messages"] == [] and seen[0]["keep_alive"] == "30m"
