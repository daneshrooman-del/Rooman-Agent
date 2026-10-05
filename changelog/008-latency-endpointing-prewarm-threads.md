# 008 — Latency: VAD endpointing, sentence-pipelined speech, warm shared models

**Plan steps:** 3 (better turn-taking: endpointing) and 5 (latency: chunk TTS, warm models)

## Result (headless caller, same sentence, this i7-3770S CPU-only machine)
| Stage of the work | caller-stops → agent-audio |
|---|---|
| After 007 (chunk turn detection) | 7.6 s |
| + VAD endpointing, per-session cold models | 10.4–11.4 s (worse: model loading/contention exposed) |
| + prewarm in idle processes | 10.4–11.0 s (Whisper inference, not loading, was the cost) |
| + **thread executor (shared models) + Whisper `tiny.en`** | **5.7–6.0 s** |

Remaining per turn: Whisper tiny.en ~2 s on a 4.9 s utterance · Gemini flash-lite ~1 s ·
Piper on a 142-char single-sentence reply ~2 s. These are CPU-bound on this 2012 machine; on a
Kaggle T4 Whisper is ~0.2 s, so the pipeline shape (not the hardware) was what this change fixed.

## What we did
1. **VAD endpointing** — new `trackb/stt/endpointing.py`, selected by
   `TRACKB_STT_TURN_DETECTION=vad` (new default; `chunk` keeps the old behaviour).
   - `SileroStreamingVAD`: faster-whisper's bundled Silero ONNX model, scored per 32 ms window with
     LSTM state carried across calls (faster-whisper's wrapper resets state every call).
   - `Endpointer`: pure state machine — speech after 160 ms above 0.5, end after
     `TRACKB_STT_MIN_SILENCE_MS` (500) below 0.35, 300 ms pre-roll, 30 s cap.
   - `EndpointedSTT`: VAD inline in `push_audio`, Whisper once per complete utterance on a
     background task (a slow transcription never stalls the audio pump; one failure doesn't
     end the session). Final events only.
   - Real-audio check: endpoint fired **0.35 s** after speech ended (chunk mode: 2–4 s), the
     sentence with a mid-pause stayed one utterance, no more words cut at chunk edges
     ("I want to- build" is gone), VAD cost ≈4% of one core.
2. **Sentence-pipelined `speak()`** — `speak(text)` now splits into sentences and goes through
   `speak_stream` (003): sentence 1 plays while the rest synthesize. No extra LLM call: intake
   and flow replies are already complete text. (This replaces the "separate streamed LLM call vs
   stream JSON field" question from 003 — neither is needed yet.)
   Transcript change: one reply = one transcript segment that grows per sentence (interim) and is
   then marked final, instead of one segment per call.
3. **Prewarm** — new `trackb/session/prewarm.py`, registered as `prewarm_fnc`: loads Whisper,
   the Piper voice and Silero, and runs one tiny inference each, before a session is assigned.
   New settings `TRACKB_WORKER_IDLE_PROCESSES` (1) and `TRACKB_WORKER_INIT_TIMEOUT_SECONDS` (60):
   LiveKit's default 10 s init limit was shorter than model loading here and it killed/respawned
   warming processes forever.
4. **Thread job executor** — `TRACKB_WORKER_JOB_EXECUTOR=thread` (new default; `process`
   available). All sessions run in one process and share one copy of the models
   (`shared_models`, loaded once under a lock). Why: per-session processes reloaded models for
   every call, and warming the *next* process competed for CPU with the live call (Whisper took
   5 s in-session vs 2.8 s standalone). On Kaggle it also means one model copy in VRAM, not one per
   session. Trade-off: a native crash now takes down all sessions on that worker, not one.
   (The thread executor "hung" in 007 — that was the same AVX2 crash, fixed by `cpu_compat`.)
5. **Local `.env` only**: `TRACKB_WHISPER_MODEL_SIZE=tiny.en` (1.3 s vs 2.8 s for `base` on
   4.6 s of audio here, same transcript on clean speech). Code default stays `base`.

## Measured on the way (Whisper on 4.6 s of speech, this CPU)
| model | beam 5 | beam 1 |
|---|---|---|
| base | 3.11 s | 2.83 s |
| base.en | 3.17 s | 2.78 s |
| tiny.en | 1.58 s | 1.34 s |

## Known noise
`ERROR livekit ... publisher data channel '_reliable' closed unexpectedly` appears when a test
caller leaves; it's the previous session tearing down, not a fault in the next one.

## Files
- new: `src/trackb/stt/endpointing.py`, `src/trackb/session/prewarm.py`,
  `tests/stt/test_endpointing.py` (11 tests), `tests/session/test_prewarm.py` (6 tests)
- changed: `src/trackb/config.py`, `src/trackb/session/entrypoint.py`,
  `src/trackb/session/conversation_entrypoint.py`, `src/trackb/session/worker.py`,
  `tests/session/test_worker.py` (2 updated for the transcript change, +1)

## Verified
`pytest` → 247 passed; `ruff check` clean; three consecutive live sessions at 5.7–6.0 s.
