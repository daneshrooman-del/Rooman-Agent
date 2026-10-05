from collections.abc import AsyncIterator

import pytest

from trackb.streaming import sentence_chunks


async def _tokens(*parts: str) -> AsyncIterator[str]:
    for part in parts:
        yield part


async def _collect(*parts: str, **kwargs: int) -> list[str]:
    return [s async for s in sentence_chunks(_tokens(*parts), **kwargs)]


@pytest.mark.asyncio
async def test_splits_on_sentence_boundaries_across_token_edges() -> None:
    assert await _collect("Hello the", "re, how are", " you today? I am ", "fine.") == [
        "Hello there, how are you today?",
        "I am fine.",
    ]


@pytest.mark.asyncio
async def test_yields_sentence_before_stream_ends() -> None:
    gen = sentence_chunks(_tokens("This is one sentence. ", "And the rest"))
    assert await gen.__anext__() == "This is one sentence."
    assert await gen.__anext__() == "And the rest"


@pytest.mark.asyncio
async def test_short_fragments_merge_with_next_sentence() -> None:
    assert await _collect("Dr. Smith will see you now. Please sit.") == [
        "Dr. Smith will see you now.",
        "Please sit.",
    ]


@pytest.mark.asyncio
async def test_decimals_are_not_split() -> None:
    assert await _collect("The price is 3.5 dollars per unit today.") == [
        "The price is 3.5 dollars per unit today."
    ]


@pytest.mark.asyncio
async def test_flushes_unterminated_tail_and_ignores_blank() -> None:
    assert await _collect("no terminator here at all") == ["no terminator here at all"]
    assert await _collect("  ", "\n") == []


@pytest.mark.asyncio
async def test_newline_is_a_boundary() -> None:
    assert await _collect("First line is long enough\nSecond line is also long") == [
        "First line is long enough",
        "Second line is also long",
    ]
