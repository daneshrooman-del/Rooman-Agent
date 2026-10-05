# 013 — Step 5a: MuseTalk real-time benchmark notebook (+ test-page latency label fix)

**Plan step:** 5a (face renderer feasibility on a free T4)

## Confirmed before this step
The Kaggle worker's spoken reply reached the browser on the PC ("agent audio track subscribed",
agent transcript shown) — the voice loop works end to end across PC → LiveKit Cloud → Kaggle GPU.

## What we did
1. New `kaggle/musetalk_benchmark.ipynb` (separate from the worker notebook): clones MuseTalk,
   installs the libraries it imports (unpinned — its `requirements.txt` pins numpy 1.23 /
   tensorflow 2.12, which don't exist for Kaggle's Python 3.13), probes the OpenMMLab stack with
   a 15-minute limit, downloads weights into MuseTalk's expected `models/` layout, then runs
   MuseTalk's own `scripts.realtime_inference` (v1.5, `--skip_save_images`) on its sample avatar
   while sampling GPU memory. Pass bar: **≥ 25 fps** generated.
2. `dev/voice-test.html`: the "+N s after your message" label was overwritten when the agent's
   transcript segment was updated from interim to final (change 008 made replies one growing
   segment). The delay is now stored on the segment element and re-appended on every update.

## Known risk
MuseTalk's avatar preparation imports `mmcv`/`mmpose`; no prebuilt wheels for Python 3.13 are
expected. The probe cell reports which package fails. Fallbacks if it does: replace the
landmark/bbox step with a pure-PyTorch or MediaPipe detector (it runs once per avatar), or use a
lighter renderer (Wav2Lip-class) for the live path.

## Verified
Notebook JSON validates. **Not run yet** — needs the Kaggle GPU; results go in the next entry.
