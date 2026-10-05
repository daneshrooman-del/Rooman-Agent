# 002 — Streaming LLM interface

**Plan step:** 1 (streaming LLM → chunked TTS)

## What we did
- Added `StreamingLLMProvider` protocol (`llm/base.py`): an `LLMProvider` that also has
  `stream(prompt, system) -> AsyncIterator[str]` yielding text deltas. It is a separate protocol,
  so existing providers/fakes that only implement `complete`/`extract` stay valid.
- `GeminiLLMProvider.stream()` uses `generate_content_stream`. Only *opening* the stream is retried
  (3 attempts, backoff); a failure after text has been yielded is raised, not restarted, because the
  caller may already be speaking those words. Each chunk wait has a 10s stall timeout.
- `MockLLMProvider.stream()` yields the canned completion a word at a time.

## Why
First-token latency is what the user feels. `complete()` makes them wait for the whole reply.

## Finding worth knowing
Intake (`IntakeGraph`) and the flow engine (`FlowGraphDriver`) use `extract()` — structured JSON —
not `complete()`. A half-built JSON object isn't speakable, so these paths don't benefit from this
change yet. Wiring streaming into them needs a design decision (e.g. a separate free-form
"say it" call after the structured step, or streaming only the `response_text` field). Not done here.

## Files
- changed: `src/trackb/llm/base.py`, `gemini.py`, `mock.py`
- changed: `tests/llm/test_gemini.py` (+2 tests); new: `tests/llm/test_mock_stream.py`

## Verified
`pytest tests/llm tests/streaming` → 21 passed; `ruff check` clean.
