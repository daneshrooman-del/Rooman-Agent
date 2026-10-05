import pytest

from trackb.llm.base import StreamingLLMProvider
from trackb.llm.mock import MockLLMProvider


@pytest.mark.asyncio
async def test_mock_stream_yields_words_that_rejoin_to_the_completion() -> None:
    llm = MockLLMProvider(complete_fn=lambda p: "Sure thing. Here you go!")

    pieces = [p async for p in llm.stream("x")]

    assert len(pieces) == 5
    assert "".join(pieces) == "Sure thing. Here you go!"
    assert isinstance(llm, StreamingLLMProvider)
