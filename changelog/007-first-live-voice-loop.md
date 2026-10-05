# 007 — First live voice loop, end to end (local)

**Plan step:** 1 (voice-only loop working end to end)

## Result
Caller speaks into a LiveKit room → faster-whisper → intake graph (Gemini flash-lite) → Piper →
agent audio + transcripts back in the room. Verified with a headless caller (a Python LiveKit
client that joins via `POST /intake/start`, speaks a Piper-synthesized sentence, and records the
reply):

```
[caller] Hi, I want to- build an agent that answers customer questions. questions from my shoe store.
[agent]  What are the ordered steps this agent should walk through during a call, ...
agent audio began 7.59s after caller stopped speaking   (was 15.86s before the Whisper fix below)
```

## What we did
1. **Project venv on Python 3.13** (`.venv`, gitignored). All runtime deps except
   `sentence-transformers` (pulls multi-GB torch; only imported lazily for KB ingestion).
   Full suite: 230 passed.
2. **Models** (gitignored `models/`): Piper `en_US-lessac-medium` (63 MB); Whisper `base` in the
   HF cache. Piper: 4.8 s of speech synthesized in 0.42 s; Whisper transcribed it word-for-word.
3. **Fix: LiveKit job processes crashed on this CPU** — new `trackb/session/cpu_compat.py`.
   - Symptom: worker logs only `no process became available after 3 attempts`.
   - Root cause (from `dmesg`): `trap invalid opcode` in `livekit/local_inference/_native...so`.
     livekit-agents ≥1.8 warms up its bundled VAD/turn-detector in every job process; the binary
     needs AVX2, and this machine's i7-3770S (Ivy Bridge) only has AVX.
   - Fix: on CPUs without AVX2 only, replace `local_inference.init_vad/init_eot` with functions that
     raise; LiveKit's preload already skips a warm-up step that raises. Registered as a LiveKit
     `Plugin` so the forkserver loads it before the preload. No-op on AVX2 machines (Kaggle).
     We don't use that model anyway (turn detection is faster-whisper's VAD).
   - Ruled out on the way: Python 3.14 (same failure on 3.13), `spawn` start method (SIGILL),
     thread executor (hung). First guard attempt blocked the import entirely — wrong, because
     `import livekit.agents` itself imports it; only the initializers are unsafe.
4. **Fix: Whisper language detection on every chunk** — new setting `TRACKB_WHISPER_LANGUAGE`
   (default `None` = auto-detect, unchanged). Detection ran even on chunks VAD had emptied and cost
   ~1.4 s per 2 s chunk on this CPU, so STT fell behind real time. With `en`, silent chunks take
   ~10 ms. Set to `en` in the local `.env`.
5. **Dev test page** `dev/voice-test.html`: starts an intake session via the API, joins the room
   with the mic, plays agent audio, shows live transcripts, has a text box, and prints
   "+Ns after your final transcript" per reply. Not part of the app build.
6. Local `.env` additions: Piper model path, CORS origin for the test page, Whisper language.

## Latency now (≈7.6 s), where it goes
| Stage | Time | Fix (plan step) |
|---|---|---|
| Waiting for a fully silent 2 s chunk to end the turn | ~2–4 s | real VAD + endpointing (step 3) |
| Gemini flash-lite (structured `extract`) | ~1 s | — |
| Piper synth of the whole reply, then publish | ~3 s | sentence-chunked `speak_stream` (003) once wired |
Also visible: 2 s chunk boundaries cut words ("I want to- build"); fixed by step 3 too.

## Files
- new: `src/trackb/session/cpu_compat.py`, `tests/session/test_cpu_compat.py` (3 tests),
  `dev/voice-test.html`
- changed: `src/trackb/session/entrypoint.py`, `conversation_entrypoint.py` (register the guard),
  `src/trackb/config.py`, `src/trackb/stt/whisper_stt.py`, `tests/stt/test_whisper_stt.py` (+1),
  `.gitignore` (`models/`, `.logs/`)

## How to run it yourself
```bash
docker compose -f infra/livekit/docker-compose.yml up -d        # LiveKit (already running)
.venv/bin/uvicorn trackb.api.app:app --port 8000                 # API
.venv/bin/python -m trackb.session.entrypoint dev                # agent worker
python3 -m http.server 8765 -d dev                                # test page
# open http://localhost:8765/voice-test.html → Start intake session → talk
```

## Follow-up: test page mic handling
First real browser run failed with `Requested device not found` (no usable microphone), and the
page treated that as fatal: connected to the room but left the text box disabled. Now a mic error
keeps the session connected, enables typing, and lists the audio inputs the browser can see
(helps tell "no mic plugged in" from "browser has no OS audio access").
