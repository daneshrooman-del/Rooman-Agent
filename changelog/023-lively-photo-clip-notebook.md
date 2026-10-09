# 023 — Livelier photo avatar: chained talking drivers, own Kaggle notebook

**Plan step:** 5c (avatar quality)

## Why
With the 022 clip the live avatar looked too static. Cause: the clip used LivePortrait's
*calmest* driver (d13) at 0.8 motion strength, and MuseTalk only moves the mouth. The user wanted
it livelier and rendered on Kaggle (the 2 h CPU render was too slow).

## What we did
- `kaggle/musetalk_patches/photo_to_clip.py`: renders the photo once per driving clip and joins
  the parts. Default drivers **d20, d19, d13** (talking, calm, calm-with-head-motion) at full
  strength (`--multiplier 1.0`) → ~27 s of nods, tilts, blinks and expression changes, so the
  loop repeats less. `--flag_normalize_lip` still closes the lips first. Relative motion means
  every part starts from the photo's pose, so the joins don't jump.
- Fixed on the way: joining mixed 25/30 fps parts directly (concat demuxer, `-r 25` or
  `-vf fps=25`) re-timed every frame at 25 fps and played 30 fps parts 20 % slow (6.0 s of driver
  → 7.2 s clip). Each part is now resampled to 25 fps by time first, then joined with stream copy.
- `kaggle/photo_to_avatar.ipynb`: **standalone** notebook (own session — LivePortrait next to the
  worker/MuseTalk ended a session in 021). Finds the photo under `/kaggle/input`, installs
  LivePortrait (CPU `onnxruntime` only), downloads weights, runs the script on the GPU, shows 6
  preview frames and a download link; then the clip goes into the dataset and the worker's
  `AVATAR_VIDEO`.

## Verified
- Script tested locally against a stand-in `inference.py` with LivePortrait's CLI and output
  naming (`<photo>--<driver>.mp4`, photo size, driver fps): 3 parts (25/30/30 fps, 2 s each) →
  **150 frames @ 25 fps = 6.0 s**, 612×386; `--max-seconds` trimming works. `ruff` clean.
- LivePortrait itself on this photo was already verified in 021/022. The full GPU run is the
  user's (scratch LivePortrait setup was wiped by a reboot; rebuilding it locally ≈ 30 min).

## Follow-up: Kaggle session crashed during the photo notebook
Symptoms: the session restarted during rendering; afterwards `{LP}` was undefined and then
`/kaggle/working/LivePortrait` was missing — the working directory itself was gone, so the crash
point (setup vs. render) and cause (likely RAM) are unknown.
- Setup cell prints its step (1/3 clone, 2/3 install, 3/3 weights) so a crash can be placed.
- Render cell now runs the script in the **background** and logs progress (`render.log`) and memory
  every 2 s (`mem.log`) to files; it prints the photo's size and the driver clips' resolutions
  first (a very large input would explain a RAM blow-up). New progress cell reads the logs (works
  after a kernel restart). Preview cell is standalone.
- Fixed before it shipped: `print(...); !cmd` on one line is invalid in IPython (`!` must start a
  line). All cells of both Kaggle notebooks now checked with IPython's own `TransformerManager`,
  which handles `!` lines like Kaggle does (previous checks skipped those lines).
