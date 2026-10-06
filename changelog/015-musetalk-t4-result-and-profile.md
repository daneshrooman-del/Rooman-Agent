# 015 — MuseTalk on a T4: 11 fps (below real time); stage profiler

**Plan step:** 5a

## Benchmark result (MuseTalk 1.5, fp16, one T4, batch 20, sample avatar `yongen.mp4`)
| clip | frames | time | throughput |
|---|---|---|---|
| audio_0 (includes first-call warm-up) | 200 | 28.6 s | 7.0 fps |
| audio_1 | 1500 | 132.3 s | **11.3 fps** |
Peak GPU memory 10.2 GiB of 15 GiB. Real time needs 25 fps → **2.2× short**. fp16 is already on
(upstream script calls `.half()`), so that lever is used. Only GPU 0 of the two T4s was used.

## Why we're profiling before choosing a fix
The reported total is the slower of two concurrent stages: the GPU loop (Whisper features → UNet →
VAE decode, batched) and one CPU thread that, per frame, deep-copies the full 704×1216 frame,
resizes the generated face and mask-blends it in. The fix depends on which one limits:
- GPU-bound → run two model copies, one per T4, alternating batches (~2×), and/or smaller batches;
- CPU-bound → blend only the face region / several blend workers; the GPU may already be fast enough.

## What we did
- `kaggle/musetalk_patches/make_profile_script.py`: writes `scripts/realtime_profile.py`, a copy of
  upstream `realtime_inference.py` with per-stage busy timers (GPU loop with
  `torch.cuda.synchronize()`, CPU blend per frame). Substitutions are asserted to match exactly once.
  Checked against the current upstream file: applies cleanly and compiles.
- Benchmark notebook: new last cell runs the profiler on the already-prepared avatar
  (`preparation: False`, same `bbox_shift` so MuseTalk doesn't prompt) and prints
  `PROFILE frames=… gpu_busy=…s (… fps) blend_busy=…s (… fps)` plus the CPU core count.

## Not done yet
Choosing between the fixes above — waits for the profile numbers. A lighter renderer for the live
path remains the fallback if neither gets near 25 fps.

## Follow-up: second benchmark run, profiler merged into the benchmark cell
- Re-run on a fresh session reproduced the result: 1500 frames in 128.4 s (**11.7 fps**), 200 in
  26.3 s, peak GPU memory 10.2 GiB.
- The profile cell never ran: the user's notebook copy was imported before it existed, and the
  Kaggle session had stopped, so pasting the cell alone would have failed (MuseTalk, weights and the
  prepared avatar are gone with the session).
- Fix: the separate profile cells are removed; the main benchmark cell now runs the
  timer-instrumented copy of MuseTalk's script directly (same frames, plus a `PROFILE` line per
  clip) and prints the CPU core count. One Run All gives totals, per-stage busy times and GPU memory.
