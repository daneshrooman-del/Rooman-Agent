# 018 — MuseTalk is real-time on 2× T4 with TAESD; enabled in the Kaggle worker

**Plan step:** 5c → live

## Result (Kaggle, `trackb` `MuseTalkRenderer`, 500 frames of `eng.wav`, batch 8, warm)
| devices | decoder | throughput | first frame | peak VRAM / GPU | load |
|---|---|---|---|---|---|
| 1× T4 | sd-vae | 10.1 fps | 0.84 s | 2.9 GiB | 34 s |
| 2× T4 | sd-vae | 15.1 fps | 0.90 s | 2.9 / 2.8 GiB | 45 s |
| 2× T4 | **taesd** | **28.8 fps** ✅ | **0.43 s** | 2.0 / 1.9 GiB | 47 s |

- Real time needs 25 fps → **2× T4 + TAESD clears it with ~15 % headroom**.
- Visual check (frame 50, side by side): TAESD is hard to tell apart from SD-VAE at 512×512.
- Two GPUs scaled 1.5×, not 2×, with SD-VAE: something shared (Whisper features on GPU 0, CPU
  blending) limits scaling. TAESD roughly doubling throughput shows most GPU time was SD-VAE decode.
- VRAM headroom leaves room for Whisper `small.en` and the rest of the worker on the same GPUs.

**Decision:** live agent uses `devices=["cuda:0","cuda:1"]`, `decoder=taesd`, 25 fps.
Headroom is modest; if playback stutters under load, drop `TRACKB_AVATAR_FPS` to 20.

## What we did
- Worker notebook `kaggle/trackb_agent_worker.ipynb`: new "agent's face" section with an `AVATAR`
  switch (`"musetalk"` default | `"placeholder"` | `"none"`). For MuseTalk it clones MuseTalk,
  installs its libraries + `face-alignment`, applies our landmark patch, downloads the weights, and
  prepares the sample avatar once with MuseTalk's own script using an empty `audio_clips` list
  (prepare-and-exit; skipped if `latents.pt` already exists, so re-running doesn't hit MuseTalk's
  interactive "re-create?" prompt).
- Worker env: `TRACKB_AVATAR_RENDERER=musetalk`, MuseTalk paths, both GPUs, `taesd`,
  `TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD=1`, `TRACKB_WORKER_INIT_TIMEOUT_SECONDS=300` (MuseTalk loads in
  ~45 s; the default 60 s would be too tight). Worker cell waits 90 s and also greps for
  `models_prewarm_failed` / tracebacks.
- The guarded MuseTalk cells use `subprocess` instead of `!` lines (IPython shell escapes with
  line continuations don't work inside an `if` block); all compile with warnings as errors.

## Verified
Notebook JSON valid; the new cells compile. **Not yet run end-to-end on Kaggle.**
