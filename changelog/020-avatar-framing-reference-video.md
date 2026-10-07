# 020 — Full-body framing and a selectable reference video (for gestures); 20 fps live

**Plan step:** 5c → live

## What the live test showed after 019
- **Voice now smooth** (audio-master-clock fix works).
- **Avatar laggy**: live, MuseTalk shares GPU 0 with Whisper and the 4 vCPUs also encode video,
  so it falls below the 25 fps it reached alone (28.8 fps benchmark) and frames get repeated.
- **Only eyes and lips move; user wants hand gestures.**

## Gestures: what's possible
MuseTalk only regenerates the mouth; all other motion (blinks, head, hands) is the reference video
looping. Real-time options on free T4s:
- **Reference video that already contains natural gestures** (30–60 s waist-up clip, face to
  camera) — same cost as now; gestures aren't tied to the words but read as natural talking. This
  is the practical path and what this change enables.
- Audio-driven generated gestures (e.g. EchoMimicV2) — minutes per clip on a T4: not real time.

## What we did
- `MuseTalkRenderer(framing=...)` / `TRACKB_AVATAR_FRAMING`: `head` (square face crop, as before)
  or `full` (whole reference frame scaled to `TRACKB_AVATAR_OUTPUT_SIZE` tall, width at the
  source aspect ratio, even for the encoder) — keeps body and hands in the picture.
- Worker notebook: `AVATAR_VIDEO` / `AVATAR_ID` / `FRAMING` / `AVATAR_FPS` variables; the prepare
  cell prepares whichever video is chosen. Defaults: MuseTalk's `sun.mp4` (real person, waist-up,
  22 s, 576×768 — little actual gesturing, but natural and body-framed), `full`, **20 fps**.
  A custom video goes in via Add Input → Upload and its `/kaggle/input/...` path.
- `dev/voice-test.html`: the video box keeps the stream's aspect ratio (was forced square).

## Verified
New test: full framing of a 576×768 source → 384×512 output, idle frame shape, bad framing value
rejected. `pytest` → 272 passed; `ruff` clean; changed notebook cells compile. **Not yet run on
Kaggle.**
