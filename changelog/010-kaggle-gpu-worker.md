# 010 — Kaggle GPU worker notebook + GPU settings for Whisper

**Plan step:** Kaggle compute (prerequisite for the face renderer)

## What we did
- New settings `TRACKB_WHISPER_DEVICE` (default `cpu`) and `TRACKB_WHISPER_COMPUTE_TYPE`
  (default `int8`); `WhisperSTT` and the prewarm loader read them (were hardcoded cpu/int8).
  On a T4: `cuda` + `float16`.
- New notebook `kaggle/trackb_agent_worker.ipynb`, which:
  1. checks the GPU; clones branch `feature/realtime-voice-loop` (public repo, no token needed);
  2. installs runtime deps + the CUDA libs ctranslate2 needs (cuBLAS, cuDNN 9);
  3. starts Redis (apt) for session state; downloads the Piper voice;
  4. reads the four secrets from **Kaggle Secrets** into the worker's environment (never printed)
     and sets GPU config (Whisper `small.en` on CUDA, Gemini flash-lite, language `en`);
  5. sanity-checks Whisper on CUDA in a subprocess (falls back to CPU by editing two env values);
  6. starts `python -m trackb.session.entrypoint start` and shows its log; a last cell stops it.
- The worker connects **outbound** to LiveKit Cloud — no inbound ports needed on Kaggle.

## Important when testing
The worker on the PC and the one on Kaggle both register as `trackb-intake` in the same LiveKit
project; stop the PC worker or sessions may land on either.

## Files
- new: `kaggle/trackb_agent_worker.ipynb`
- changed: `src/trackb/config.py`, `src/trackb/stt/whisper_stt.py`, `src/trackb/session/prewarm.py`,
  `tests/stt/test_whisper_stt.py` (+1)

## Verified
`pytest` → 248 passed; `ruff check` clean; notebook JSON validates. **Not yet run on Kaggle** —
first run is the user's (needs their Kaggle account and secrets).
