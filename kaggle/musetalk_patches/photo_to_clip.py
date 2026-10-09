"""Animate one photo into a lively reference clip for the MuseTalk avatar, with LivePortrait.

    python photo_to_clip.py --photo face.png --lp-dir LivePortrait --out avatar.mp4
           [--drivers d20,d19,d13] [--multiplier 1.0] [--max-seconds 0] [--cpu]

Each driving clip is rendered separately (LivePortrait's output is always the photo's size, so
the parts concatenate cleanly) and joined into one clip. With relative motion every part starts
from the photo's own pose, so the joins don't jump. Talking-style drivers give natural nods,
tilts and expression changes; MuseTalk replaces the mouth live, so the drivers' mouth movement
doesn't matter (`--flag_normalize_lip` closes the lips first in case the photo shows teeth).

`--max-seconds` trims each driver (for a quick test); `--cpu` runs without a GPU (slow).
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
import time

import cv2
import imageio_ffmpeg

DEFAULT_DRIVERS = "d20,d19,d13"  # talking, calm, calm-with-head-motion (see changelog 023)


def trim(src: str, dst: str, seconds: float) -> str:
    cap = cv2.VideoCapture(src)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    ok, frame = cap.read()
    h, w = frame.shape[:2]
    out = cv2.VideoWriter(dst, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    for _ in range(max(1, int(seconds * fps))):
        if not ok:
            break
        out.write(frame)
        ok, frame = cap.read()
    out.release()
    return dst


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--photo", required=True)
    ap.add_argument("--lp-dir", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--drivers", default=DEFAULT_DRIVERS)
    ap.add_argument("--multiplier", type=float, default=1.0)
    ap.add_argument("--max-seconds", type=float, default=0.0)
    ap.add_argument("--cpu", action="store_true")
    a = ap.parse_args()

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    env = dict(os.environ, PATH=f"{os.path.dirname(ffmpeg)}:{os.environ.get('PATH', '')}")
    stem = os.path.splitext(os.path.basename(a.photo))[0]
    work = tempfile.mkdtemp(prefix="lp_")
    parts = []
    for name in a.drivers.split(","):
        driver = os.path.join(a.lp_dir, "assets", "examples", "driving", f"{name}.mp4")
        if a.max_seconds:
            driver = trim(driver, os.path.join(work, f"{name}.mp4"), a.max_seconds)
        cmd = [sys.executable, "inference.py", "-s", os.path.abspath(a.photo), "-d", driver,
               "-o", work, "--flag_normalize_lip", "--driving_multiplier", str(a.multiplier)]
        if a.cpu:
            cmd += ["--flag_force_cpu", "--no-flag_use_half_precision"]
        started = time.time()
        r = subprocess.run(cmd, cwd=a.lp_dir, env=env, capture_output=True, text=True)
        part = os.path.join(work, f"{stem}--{name}.mp4")
        if r.returncode or not os.path.exists(part):
            print(f"FAILED on driver {name}:\n{r.stdout[-2000:]}\n{r.stderr[-3000:]}")
            return 1
        frames = int(cv2.VideoCapture(part).get(cv2.CAP_PROP_FRAME_COUNT))
        print(f"{name}: {frames} frames in {time.time() - started:.0f}s")
        parts.append(part)

    # Driver clips are 25 or 30 fps. Resample each part to 25 fps by time on its own, then join
    # the now-identical parts: concatenating mixed-fps parts directly re-timed every frame at 25 fps
    # and played the 30 fps parts 20 % slow.
    normalized = []
    for i, part in enumerate(parts):
        dst = os.path.join(work, f"part{i}_25fps.mp4")
        r = subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", part, "-vf", "fps=25",
                            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", dst],
                           capture_output=True, text=True)
        if r.returncode:
            print("ffmpeg resample failed:", r.stderr[-2000:])
            return 1
        normalized.append(dst)
    listing = os.path.join(work, "parts.txt")
    with open(listing, "w") as f:
        f.writelines(f"file '{p}'\n" for p in normalized)
    r = subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                        "-i", listing, "-c", "copy", a.out], capture_output=True, text=True)
    if r.returncode:
        print("ffmpeg concat failed:", r.stderr[-2000:])
        return 1
    cap = cv2.VideoCapture(a.out)
    n, fps = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)), cap.get(cv2.CAP_PROP_FPS)
    print(f"CLIP {a.out}: {n} frames @ {fps:.0f} fps = {n / fps:.1f}s, "
          f"{int(cap.get(3))}x{int(cap.get(4))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
