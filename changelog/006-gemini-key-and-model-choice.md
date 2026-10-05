# 006 — Gemini key configured; switched live model to flash-lite

**Plan step:** LLM stage / latency

## What we did
- Stored the Gemini API key in the repo-root `.env` (gitignored, file mode 600). The key is not in
  this changelog, `.env.example`, or any commit.
- `.env` also points the backend at the local LiveKit server (005) and selects
  `TRACKB_GEMINI_MODEL=gemini-flash-lite-latest`.
- Documented the LLM settings (without the key) in `.env.example`.
- No code changes.

## Measurements (this machine, prompt: "In three short sentences, what is WebRTC?")
| Model alias → resolved | first sentence | total | notes |
|---|---|---|---|
| `gemini-flash-latest` → gemini-3.8-flash | 3.0–5.1 s | 3.1–5.1 s | one 503 "high demand"; whole reply arrives in one burst |
| `gemini-flash-lite-latest` → gemini-3.5-flash-lite | **0.85–0.98 s** | 1.1–1.2 s | streams properly |

`thinking_budget=0` didn't help on flash (4.2 s) and is rejected (HTTP 400) by flash-lite.

## Free-tier limits hit
`gemini-3.8-flash`: **5 requests/minute per project** (`GenerateRequestsPerMinutePerProjectPerModel-FreeTier`),
returned as 429 with a ~34 s retry delay. Our test burst of ~6 calls exhausted it. Every
conversation turn is ≥1 request, so flash on the free tier caps a session at ~5 turns/minute.
flash-lite's quota wasn't hit in testing. This is the main argument for keeping the Ollama
provider (004) ready for the Kaggle GPU.

## Follow-ups noted, not done
- `GeminiLLMProvider` retries 429s immediately (3x with ≤4 s backoff) which can't succeed against a
  34 s window; it should honour `retryDelay` or fail fast.
- Structured `extract()` quality on flash-lite (intake, flow engine) not yet checked.

## Verified
`complete()` and `stream()` via `build_llm_provider()` returned real replies from the `.env` config.
