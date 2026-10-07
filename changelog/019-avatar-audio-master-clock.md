# 019 — Avatar playback: audio is the master clock (fixes broken-up voice with MuseTalk)

**Plan step:** 5c → live

## What the first live MuseTalk test on Kaggle showed
- Turns worked (typed message → Gemini → Piper in ~1–2 s, logged).
- **Voice broke up.** Cause (design flaw in 016): `AvatarAVOutput.say()` pushed each 40 ms of
  audio only *after* its video frame. MuseTalk yields frames in bursts (one 8-frame batch per GPU)
  and, on 2×T4 + TAESD, only ~15 % faster than real time on average (28.8 vs 25 fps) while the
  same 4 vCPUs also encode video. Whenever the next batch was late, audio waited for video and the
  100 ms audio queue ran dry → audible gaps.
- **"Image static, only lips move"** — expected from MuseTalk: it regenerates only the mouth
  region; all other motion comes from the reference video, and MuseTalk's sample `yongen.mp4` is
  an almost-still illustration. A real reference video of a person (natural blinks, small head
  movement) fixes most of it; generated expressions/head motion (Tavus-style) need another model
  (e.g. LivePortrait) — later.

## What we did
`AvatarAVOutput.say()` rewritten:
- frames are rendered into a buffer by a background task;
- playback starts once `preroll_frames` (default 8 = one MuseTalk batch, so no extra latency) are
  buffered;
- every `1/fps` audio window is pushed on schedule; if its frame isn't ready the previous frame is
  shown again; frames arriving after their window are skipped (lips never lag or run ahead);
- per reply it logs `avatar_said frames=… repeated=… skipped=… preroll_ms=…`, so the Kaggle log
  shows directly whether the GPUs keep up.

## Verified
- New tests: renderer stalls 2 s after one batch → all 20 audio windows pushed in < 1 s with the
  last frame repeated; late frames skipped and never shown ahead of / out of order; fast renderer →
  every frame in its own window. `pytest` → 271 passed; `ruff` clean.
- Live (local LiveKit, placeholder face): lip-sync lag **−20 / −10 ms** (unchanged), 20 fps,
  `avatar_said … repeated=0 skipped=0`.
- **Not yet re-tested with MuseTalk on Kaggle.**

## Follow-up: worker exited on `ModuleNotFoundError: structlog`
The Kaggle session had restarted (idle timeout), which wipes installed packages, Redis and models;
re-running only clone/config/worker cells then started a worker in an empty environment. The worker
cell now checks the essential packages (and the MuseTalk ones when `AVATAR="musetalk"`) and Redis
before starting, and says "the session was reset — Run All" instead of launching a doomed worker.

## Follow-up: worker exited on `ModuleNotFoundError: structlog`
The Kaggle session had restarted (idle timeout), which wipes installed packages, Redis and models;
re-running only clone/config/worker cells then started a worker in an empty environment. The worker
cell now checks the essential packages (and the MuseTalk ones when `AVATAR="musetalk"`) and Redis
before starting, and says "the session was reset — Run All" instead of launching a doomed worker.
- First version of that check ran in the notebook kernel and wrongly reported `trackb` missing:
  the kernel started before `pip install -e`, and editable installs are only discovered when
  Python starts. The check now runs in a fresh Python with the worker's env (as the worker does).
