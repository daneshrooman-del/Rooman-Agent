# 022 — Photo avatar clip rendered locally; captions in step with the voice

**Plan step:** 5c

## Photo → animated reference clip (rendered on the dev PC)
Because the LivePortrait cell ended the Kaggle session (021), the clip was rendered here on CPU:
`photo--d13.mp4`, 352 frames @ 30 fps = 11.7 s, 612×386, 214 KB, in ~2 h (17:59). Six frames
across the clip: natural head movement and tilt, varied mild expression, identity preserved.
Copied to `models/avatar/photo-avatar.mp4` (gitignored — the photo/likeness isn't committed) for
the user to add to their Kaggle dataset and use via `AVATAR_VIDEO`, with `PHOTO` left empty.

## Caption timing
The test page's "+N s after your message" read ~9 s with the MuseTalk face. Not a 9 s delay:
`speak_stream` posted each sentence's caption *after* `publish_audio`, and with an avatar that
returns only once the clip has been paced out (≈ its whole duration, ~6 s for the intake
question). Captions now go out as each sentence starts playing, whenever the agent's track
already exists (always with an avatar, which publishes at session start); the first sentence of an
audio-only session, whose track is published lazily, is still captioned right after.

## Files
- changed: `src/trackb/session/worker.py`, `tests/session/test_worker.py` (+1: caption before
  audio once the track exists)

## Verified
`pytest` → 273 passed; `ruff` clean.

## Follow-up: notebook robustness
- Config cell: `FRAMING`/`AVATAR_FPS` fall back to `"full"`/`"20"` if a line went missing from
  the avatar cell (a pasted snippet had replaced it → `NameError: AVATAR_FPS`).
- Worker cell: if Redis isn't running (its cell skipped), it now starts Redis itself instead of
  stopping with a misleading "session was reset" message; it only fails if Redis can't start.
