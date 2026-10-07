# 021 — Avatar from a single photo (LivePortrait → MuseTalk)

**Plan step:** 5c (avatar identity)

## Approach
MuseTalk accepts a still image, but then only the lips move (frozen face). Instead:
1. **LivePortrait** animates the photo once, offline, into a ~12 s clip with blinks, small head
   movement and mild expression, copying motion from a "driving" clip;
2. that clip becomes MuseTalk's reference video, lip-synced live as before (no extra live cost).
A photo can't give hand gestures (no hands to move; these models animate head/face only).

Driving clip: of LivePortrait's 12 bundled clips most are exaggerated expressions (grimaces, wide
eyes); **d13** (11.7 s, calm face, small natural head motion) is used. `--flag_normalize_lip`
closes the lips first (the test photo has a wide toothy smile, which MuseTalk would otherwise use
as its mouth reference); `--driving_multiplier 0.8` tones the motion down.

## Verified locally (CPU, user's test photo, 1 s of d13)
- Ran end to end: 25 frames in 7.5 min on this CPU (seconds on a T4), output keeps the full photo
  (612×386, pasted back) — background and shoulders intact.
- Identity preserved; small head motion across frames; lips softened/closed on early frames, the
  driving expression brings some smile back later (MuseTalk regenerates the mouth while talking).
- Soft, as expected from a 612-px-wide source; a larger original would look better.
- Needed packages (LivePortrait pins don't exist for Python 3.13): tyro, pykalman, rich, lmdb,
  albumentations, onnx, onnxruntime, imageio-ffmpeg, ffmpeg-python, scikit-image, requests (+ torch,
  opencv, transformers). Weights: `KwaiVGI/LivePortrait` without the animal models, 629 MB.

## What we did
Worker notebook: `PHOTO` variable (empty = use `AVATAR_VIDEO`). When set, a new cell clones
LivePortrait, installs the packages above (onnxruntime-gpu on Kaggle), downloads the weights, runs
`inference.py -s PHOTO -d d13.mp4 --flag_normalize_lip --driving_multiplier 0.8`, and points
`AVATAR_VIDEO`/`AVATAR_ID` at the result; the existing MuseTalk preparation then uses it.

## Consent / rights
The test photo looks like a stock image. Stock licences often forbid using a model's likeness as
a talking AI avatar. The photo is **not** committed to this public repo; it's uploaded to Kaggle by
the user. Only animate photos you have rights and consent for.

## Not yet verified
On Kaggle (GPU, full 11.7 s clip, onnxruntime-gpu on Python 3.13).

## Follow-up: first Kaggle attempt
`PHOTO` was set to the dataset's web address (`www.kaggle.com/datasets/...`) instead of the file's
path under `/kaggle/input/...`. The photo cell now checks the path first and, if it doesn't exist,
says so and lists the image files that are under `/kaggle/input` (or that no dataset is attached).
The user also reported the session terminating — cause not yet known (see next entry).

## Follow-up: Kaggle session terminated while running the photo cell
Running the LivePortrait cell ended the whole Kaggle session (no log survives a session end).
Likely causes: RAM (a worker from an earlier run still holding MuseTalk in RAM and on both GPUs,
plus LivePortrait) and/or installing `onnxruntime-gpu` alongside the CPU `onnxruntime` that Piper
and faster-whisper already use. Changes:
- photo cell stops a still-running worker first and no longer installs `onnxruntime-gpu`
  (LivePortrait only uses onnxruntime for one-off face detection; CPU is enough);
- **workaround that avoids LivePortrait on Kaggle entirely**: the clip is rendered on the dev PC
  (CPU, ~1 h for the 11.7 s clip), uploaded to the Kaggle dataset, and used via `AVATAR_VIDEO`
  with `PHOTO` left empty.
