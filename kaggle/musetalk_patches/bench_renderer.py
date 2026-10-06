"""Benchmark trackb's MuseTalkRenderer on a GPU host (run from the MuseTalk checkout).

    python bench_renderer.py <devices comma-separated> <sd-vae|taesd> <batch_size> [seconds]

Renders the first `seconds` of MuseTalk's sample `data/audio/eng.wav` with the avatar MuseTalk's
own benchmark prepared, consuming frames as fast as they come (throughput, not playback), and
prints one RESULT line plus a sample frame PNG for visual comparison between decoders.
"""

import asyncio
import os
import sys
import time

import cv2
import librosa
import numpy as np
import torch

from trackb.avatar.musetalk import MuseTalkRenderer

devices = sys.argv[1].split(",")
decoder = sys.argv[2]
batch = int(sys.argv[3])
seconds = float(sys.argv[4]) if len(sys.argv) > 4 else 20.0
MT = os.getcwd()

t = time.perf_counter()
renderer = MuseTalkRenderer.load(
    musetalk_dir=MT,
    avatar_dir=f"{MT}/results/v15/avatars/avator_1",
    devices=devices,
    decoder=decoder,
    batch_size=batch,
)
load_s = time.perf_counter() - t

wav, _ = librosa.load(f"{MT}/data/audio/eng.wav", sr=16000)
pcm = (np.clip(wav[: int(16000 * seconds)], -1, 1) * 32767).astype(np.int16).tobytes()


async def run() -> tuple[float, float, int]:
    # Warm-up clip so CUDA kernels/cuDNN autotune don't count against the measurement.
    async for _ in renderer.render(pcm[: 16000 * 2 * 2]):
        pass
    for d in devices:
        torch.cuda.reset_peak_memory_stats(d)
    start = time.perf_counter()
    first = None
    n = 0
    async for frame in renderer.render(pcm):
        if first is None:
            first = time.perf_counter() - start
        n += 1
        if n == 50:
            bgr = cv2.cvtColor(frame, cv2.COLOR_RGBA2BGR)
            cv2.imwrite(f"/kaggle/working/frame_{decoder}.png", bgr)
    return time.perf_counter() - start, first or 0.0, n


total, first, n = asyncio.run(run())
mem = " ".join(f"{d}={torch.cuda.max_memory_allocated(d) / 2**30:.1f}GiB" for d in devices)
print(
    f"RESULT devices={','.join(devices)} decoder={decoder} batch={batch} load={load_s:.0f}s "
    f"frames={n} fps={n / total:.1f} first_frame={first:.2f}s mem[{mem}]"
)
renderer.close()
