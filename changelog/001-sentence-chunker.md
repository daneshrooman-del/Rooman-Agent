# 001 — Sentence chunker for streamed LLM output

**Plan step:** 1 (streaming LLM → chunked TTS)

## What we did
- Added `trackb/streaming/sentences.py` with `sentence_chunks(tokens)`: turns an async stream of
  LLM tokens into whole sentences, yielding each one as soon as its terminator arrives.
- Splits on `. ! ? …` followed by whitespace, or on newlines; keeps decimals like `3.5` intact.
- Fragments under 12 chars are merged into the next sentence, so "Dr." doesn't false-split and
  TTS never receives tiny choppy clips.
- Flushes any unterminated tail when the stream ends.

## Why
TTS sounds natural per sentence. Yielding sentence-by-sentence lets synthesis begin while the LLM
is still generating, instead of waiting for the full reply.

## Files
- new: `src/trackb/streaming/__init__.py`, `src/trackb/streaming/sentences.py`
- new: `tests/streaming/test_sentences.py` (6 tests)

## Verified
`pytest tests/streaming` → 6 passed.
