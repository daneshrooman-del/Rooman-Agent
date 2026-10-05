# 012 — First working turn on the Kaggle GPU; prewarm Gemini SDK; stop cell

**Plan step:** Kaggle compute

## Result of the second Kaggle run
- Config applied (Gemini, CUDA Whisper `small.en`, Piper). Models prewarmed in **3.35 s** on the T4
  (15–20 s on the dev PC). Worker registered with LiveKit Cloud.
- Typed turn from the PC's test page, handled on Kaggle: message received 09:11:11 → Gemini reply
  and follow-up question → Piper audio ready 09:11:12 (**~1 s** server-side).
- pip warned about `google-adk` vs `opentelemetry` versions — a Kaggle preinstall we don't use;
  harmless.

## What we did
1. `prewarm` now imports the Gemini SDK when `llm_provider == "gemini"`. LiveKit warned the first
   turn blocked the event loop for 2715 ms importing `google.genai`.
2. Notebook stop cell (and the "stop previous worker" path): `terminate()`, wait 10 s, then
   `kill()`. In `start` mode LiveKit drains on SIGTERM — it waits for live sessions to finish — so
   with the browser still connected the old `wait(timeout=30)` raised `TimeoutExpired`.

## Files
- changed: `src/trackb/session/prewarm.py`, `kaggle/trackb_agent_worker.ipynb`

## Verified
`pytest` → 249 passed; `ruff check` clean.
