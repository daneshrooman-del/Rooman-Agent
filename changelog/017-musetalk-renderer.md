# 017 — Step 5c: MuseTalk live renderer (multi-GPU, streamed, optional TAESD)

**Plan step:** 5c (real lip-sync renderer behind the 016 video path)

## Profile result that drove this (Kaggle T4, MuseTalk's own script, 1500 frames)
`PROFILE frames=1500 gpu_busy=124.8s (12.0 fps) blend_busy=30.5s (49.2 fps)` — total 125.3 s,
4 CPU cores, 10.2 GiB peak VRAM. **GPU-bound**: the GPU stage alone caps at 12 fps; CPU blending
runs at 4× the needed rate, so optimising it can't help.

## What we did
- New `src/trackb/avatar/musetalk.py` — `MuseTalkRenderer` (a `FaceRenderer`):
  - **one model copy per GPU** (`devices`), frame batches sent round-robin and run in parallel
    (one thread per GPU; PyTorch releases the GIL in kernels), frames yielded strictly in order;
  - **streams**: frames are yielded as each batch finishes, so time-to-first-frame is one batch
    (default 8 frames), not the whole sentence; GPUs work `lookahead` batches ahead of playback
    while finished batches are blended on a CPU thread pool;
  - **decoder** `sd-vae` (MuseTalk's) or `taesd` (tiny decoder for the same scaled SD latents);
  - **head crop**: streams a fixed square around the head (`avatar_output_size`, 512) instead of
    the 704×1216 portrait; fixed across frames so the head doesn't jitter;
  - avatar motion continues across clips (frame cursor), and the `FaceRenderer` contract (one
    frame per `1/fps` s incl. the partial last window) holds — MuseTalk itself produces
    `floor(duration·fps)` chunks, the last one is repeated;
  - loads a MuseTalk-prepared avatar (`latents.pt`, `coords.pkl`, `full_imgs/`, `mask/`,
    `mask_coords.pkl`); audio features computed from the PCM array (MuseTalk's own helper needs a
    wav file); MuseTalk's `VAE` class hard-codes `cuda` (GPU 0), so each engine loads its own
    decoder onto its own GPU.
- Settings: `TRACKB_AVATAR_RENDERER=musetalk`, `TRACKB_MUSETALK_DIR`, `TRACKB_MUSETALK_AVATAR_DIR`,
  `TRACKB_MUSETALK_DEVICES` (JSON list), `TRACKB_MUSETALK_DECODER`, `TRACKB_MUSETALK_BATCH_SIZE`,
  `TRACKB_AVATAR_OUTPUT_SIZE`. The renderer is loaded once in prewarm and shared by sessions; each
  session still gets its own `AvatarAVOutput` (LiveKit sources, idle loop).
- `pyproject.toml`: optional extra `avatar` = `opencv-python-headless`.
- Benchmark notebook: new **Step 5c** section — clones this branch and runs
  `kaggle/musetalk_patches/bench_renderer.py` for (1 GPU, sd-vae), (2 GPUs, sd-vae),
  (2 GPUs, taesd): throughput, time to first frame, peak VRAM per GPU, plus frame 50 from each
  decoder shown side by side.

## Verified
- `tests/avatar/test_musetalk_renderer.py` (6, fake engines): frame-count contract + padding;
  two engines alternate batches with random delays and 30 frames come out in order; avatar motion
  continues across clips; two slow engines finish in ~parallel time; idle frame + head-crop
  geometry; needs ≥ 1 engine. `tests/session/test_prewarm.py` (+2).
- `pytest` → 268 passed; `ruff check` clean.
- **Not verified:** the real MuseTalk/TAESD model calls — they need the Kaggle GPUs (Step 5c cells).

## Concurrency note
Sessions share one renderer, so two simultaneous calls would share the GPUs' throughput (and the
avatar frame cursor). Fine for one caller at a time; revisit before multi-caller use.
