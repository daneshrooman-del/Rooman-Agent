"""Write scripts/realtime_profile.py: MuseTalk's realtime_inference.py plus stage timers.

The upstream script reports one total, which is the max of two concurrent stages: the GPU loop
(Whisper features -> UNet -> VAE decode, batched) and a CPU thread that blends every generated
face back into the full frame. This copy also prints how long each stage spent working, so we
know which one limits throughput. Text substitutions are asserted, so an upstream change fails
loudly instead of silently timing the wrong thing.

Usage (from the MuseTalk checkout): python make_profile_script.py
"""

from pathlib import Path

src = Path("scripts/realtime_inference.py").read_text()

subs = [
    # CPU blend stage: time from getting a generated face to finishing its blend.
    (
        "                res_frame = res_frame_queue.get(block=True, timeout=1)\n",
        "                res_frame = res_frame_queue.get(block=True, timeout=1)\n"
        "                _t_blend = time.time()\n",
    ),
    (
        "            self.idx = self.idx + 1\n",
        "            self.idx = self.idx + 1\n"
        "            self.blend_seconds = getattr(self, 'blend_seconds', 0.0) + time.time() - _t_blend\n",
    ),
    # GPU stage: per batch, from feature projection to decoded frames (decode returns numpy,
    # so it's already synchronised; synchronize() makes that explicit).
    (
        "            audio_feature_batch = pe(whisper_batch.to(device))\n",
        "            _t_gpu = time.time()\n"
        "            audio_feature_batch = pe(whisper_batch.to(device))\n",
    ),
    (
        "            recon = vae.decode_latents(pred_latents)\n",
        "            recon = vae.decode_latents(pred_latents)\n"
        "            torch.cuda.synchronize()\n"
        "            gpu_seconds += time.time() - _t_gpu\n",
    ),
    (
        "        res_frame_list = []\n",
        "        res_frame_list = []\n"
        "        gpu_seconds = 0.0\n"
        "        self.blend_seconds = 0.0\n",
    ),
    (
        "        process_thread.join()\n",
        "        process_thread.join()\n"
        "        print(f'PROFILE frames={video_num} gpu_busy={gpu_seconds:.1f}s '\n"
        "              f'({video_num / max(gpu_seconds, 1e-9):.1f} fps) '\n"
        "              f'blend_busy={self.blend_seconds:.1f}s '\n"
        "              f'({video_num / max(self.blend_seconds, 1e-9):.1f} fps)')\n",
    ),
]
for old, new in subs:
    assert src.count(old) == 1, f"upstream changed, can't find: {old!r}"
    src = src.replace(old, new)

Path("scripts/realtime_profile.py").write_text(src)
print("wrote scripts/realtime_profile.py")
