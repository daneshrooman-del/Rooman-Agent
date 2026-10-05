# 014 — MuseTalk without OpenMMLab (face-alignment landmark patch)

**Plan step:** 5a

## What the first benchmark run showed
- `openmim` (the OpenMMLab installer) **crashes on Python 3.13** before installing anything:
  `AttributeError: module 'pkgutil' has no attribute 'ImpImporter'` (removed from Python).
- Worse, installing `openmim` **downgraded Kaggle packages** (`requests` 2.28, `tqdm` 4.65,
  `urllib3` 1.26, `setuptools`), so that session must be factory-reset before reuse.

## What we did
1. New `kaggle/musetalk_patches/preprocessing.py` — drop-in for MuseTalk's
   `musetalk/utils/preprocessing.py`, the only inference-path file importing `mmpose`:
   - face box: MuseTalk's own vendored S3FD, unchanged;
   - 68 landmarks: `face-alignment` (FAN, pure PyTorch) instead of DWPose via mmpose — same iBUG
     68-point layout, which is what upstream indexes (nose points 28/29/30, `keypoints[23:91]`);
     FAN is given S3FD's box so the face isn't detected twice;
   - same bbox/`bbox_shift` logic and public names (`get_landmark_and_bbox`, `get_bbox_range`,
     `read_imgs`, `resize_landmark`, `coord_placeholder`).
   Runs once per avatar during preparation, not per frame.
2. Benchmark notebook: removed the OpenMMLab cell and the DWPose weight download; installs
   `face-alignment` and downloads the patch from this branch into the MuseTalk checkout; tells the
   user to start from a fresh session.

## Verified locally (CPU, before spending Kaggle time)
- On 7 frames sampled from MuseTalk's `yongen.mp4` (704×1216): face found in all 7, boxes stable
  frame to frame (e.g. `(214, 306, 470, 524)`), 256×218 crop from eye line to chin (checked
  visually), adjust range `[-17 ~ 25]`.
- With the patch in place, every module `scripts/realtime_inference.py` imports loads against
  unpinned `diffusers` 0.40.0 / `transformers` 5.18.0.
- Not verified: loading MuseTalk's weights and generating (3.4 GB UNet; needs the Kaggle GPU).
- Side finding: PyTorch 2.14 CPU wheels hit an AVX2 `invalid opcode` on this PC's CPU in S3FD;
  torch 2.6 CPU works. Only affects local testing on this machine (Kaggle CPUs/GPUs are fine).

## Files
- new: `kaggle/musetalk_patches/preprocessing.py`
- changed: `kaggle/musetalk_benchmark.ipynb`
