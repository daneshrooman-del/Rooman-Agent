# 004 — Local LLM via Ollama (replaces paid Gemini as the default target)

**Plan step:** LLM stage / cost

## What we did
- Added `OllamaLLMProvider` (`llm/ollama.py`), implementing `complete`, `extract` and `stream`
  against Ollama's `/api/chat` over `httpx`. No SDK dependency.
  - `extract()` uses Ollama structured outputs (pydantic JSON schema in `format`) and re-asks up
    to 3 times when a small model returns invalid JSON.
  - `stream()` parses NDJSON deltas; stalled streams time out after 30s.
  - Network errors are retried; HTTP errors become `OllamaRequestError`.
  - `keep_alive` (default 30m) keeps the model loaded; `warm_up()` loads it before the first turn.
- `build_llm_provider` now handles `TRACKB_LLM_PROVIDER=ollama`. New settings:
  `TRACKB_OLLAMA_BASE_URL` (default `http://localhost:11434`), `TRACKB_OLLAMA_MODEL`
  (default `qwen2.5:3b`), `TRACKB_OLLAMA_KEEP_ALIVE`.
- Added `httpx` to runtime dependencies (it was dev-only).
- Gemini stays available; nothing was removed.

## Why
Gemini is a metered API. Ollama is free and self-hosted, and `base_url` means the same code works
on this machine now and on the Kaggle GPU later (point it at the Ollama running there).

## Environment findings (this machine)
No Ollama installed, no GPU, ~7 GB RAM with ~1 GB free. Practical choices here: `qwen2.5:1.5b` or
`llama3.2:3b` (quantized, CPU) — expect slow-ish replies; fine for testing, not for the <1s target.
On Kaggle T4, 7–8B models are comfortable. Ollama was NOT installed by us.

## To run it
```bash
curl -fsSL https://ollama.com/install.sh | sh      # needs sudo; not done for you
ollama pull qwen2.5:3b
export TRACKB_LLM_PROVIDER=ollama TRACKB_OLLAMA_MODEL=qwen2.5:3b
```

## Files
- new: `src/trackb/llm/ollama.py`, `tests/llm/test_ollama.py` (9 tests, mocked HTTP transport)
- changed: `src/trackb/llm/factory.py`, `src/trackb/config.py`, `pyproject.toml`,
  `tests/llm/test_factory.py` (+1)

## Verified
`pytest tests/llm` → 25 passed; `ruff check` clean. Tests use `httpx.MockTransport`; **not yet
run against a real Ollama server** (none available here).

## Caveat
Intake/flow-engine rely on reliable structured extraction. 1.5–3B models are noticeably weaker at
that than Gemini; expect to tune prompts or use a larger model on the GPU.
