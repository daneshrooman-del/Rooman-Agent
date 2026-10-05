# 003 — Pipelined `speak_stream` on SessionWorker

**Plan step:** 1 (streaming LLM → chunked TTS) — also lays the cancellation groundwork for step 2

## What we did
- Added `SessionWorker.speak_stream(sentences: AsyncIterator[str])`.
- A producer task synthesizes sentence N+1 while sentence N is being published, buffered at most
  2 clips ahead (`_SPEAK_PIPELINE_DEPTH`) so a slow room can't make it run away.
- Each sentence's transcription is published *after* its audio, so the transcript only contains
  what was actually spoken (matters once barge-in cuts a reply short).
- Cancelling the call (the future barge-in hook) or a publish failure cancels the producer and
  closes the source stream, so the LLM request isn't left generating into the void.
- A TTS failure is re-raised to the caller rather than swallowed.
- Existing `speak()` is unchanged.

## How it composes
```python
await worker.speak_stream(sentence_chunks(llm.stream(prompt, system)))
```

## Files
- changed: `src/trackb/session/worker.py`
- changed: `tests/session/test_worker.py` (+5 tests: ordering, pipelining, cancellation closes
  source, TTS error propagates, no-TTS raises)

## Verified
`pytest tests/session/test_worker.py tests/llm tests/streaming tests/tts/test_base.py` → all pass;
`ruff check` clean. The first draft of the pipelining test over-specified event ordering of two
concurrent steps; relaxed it to assert what actually matters (B synthesized while A's publish is
still blocked).

## Not yet done
Nothing calls `speak_stream` yet — see the finding in 002 (intake/flow use structured `extract()`).
