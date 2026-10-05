"""Re-chunk a stream of LLM tokens into speakable sentences.

TTS sounds natural per sentence, not per token, but waiting for the whole reply adds seconds
of latency. This yields each sentence the moment its terminator arrives so synthesis can start
while the LLM is still generating the rest.
"""

from __future__ import annotations

import re
from collections.abc import AsyncIterator

# A sentence ends at . ! ? … (optionally followed by closing quotes/brackets) and then
# whitespace, or at a newline. Requiring trailing whitespace keeps "3.5" and "e.g.x" intact.
_BOUNDARY = re.compile(r"""(?:[.!?…]+["')\]]*\s+)|(?:\n+)""")

DEFAULT_MIN_CHARS = 12
"""Fragments shorter than this are merged into the next one ("Dr.", "Hi!", "Yes."), which
avoids both abbreviation false-splits and synthesizing tiny, choppy clips."""


async def sentence_chunks(
    tokens: AsyncIterator[str], *, min_chars: int = DEFAULT_MIN_CHARS
) -> AsyncIterator[str]:
    buffer = ""
    async for token in tokens:
        buffer += token
        while True:
            match = _BOUNDARY.search(buffer, min_chars)
            if match is None:
                break
            sentence = buffer[: match.end()].strip()
            buffer = buffer[match.end() :]
            if sentence:
                yield sentence
    tail = buffer.strip()
    if tail:
        yield tail
