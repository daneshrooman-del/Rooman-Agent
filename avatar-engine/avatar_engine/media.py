"""ffmpeg helpers. Uses the ffmpeg binary bundled with imageio-ffmpeg, so no system install is needed."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

AUDIO_EXTS = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aac", ".opus"}
VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}


class MediaError(RuntimeError):
    pass


def ffmpeg(*args: str | Path) -> str:
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", *map(str, args)]
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise MediaError(f"ffmpeg failed: {p.stderr.strip()[-800:]}")
    return p.stderr


def probe(path: Path) -> dict:
    """Duration / fps / size / has_audio via `ffmpeg -i` (imageio-ffmpeg ships no ffprobe)."""
    p = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    out = p.stderr
    if "Invalid data" in out or "No such file" in out:
        raise MediaError(f"Not a readable media file: {path.name}")
    info: dict = {"duration": 0.0, "fps": 0.0, "width": 0, "height": 0, "has_audio": False, "has_video": False}
    if m := re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", out):
        h, mi, s = m.groups()
        info["duration"] = int(h) * 3600 + int(mi) * 60 + float(s)
    if m := re.search(r"Stream #.*Video:.*?(\d{2,5})x(\d{2,5})", out):
        info["has_video"] = True
        info["width"], info["height"] = int(m.group(1)), int(m.group(2))
    if m := re.search(r"(\d+(?:\.\d+)?) fps", out):
        info["fps"] = float(m.group(1))
    info["has_audio"] = bool(re.search(r"Stream #.*Audio:", out))
    if not info["duration"] and (info["has_video"] or info["has_audio"]):
        # Browser MediaRecorder WebM files carry no duration header — decode to measure it.
        p = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path), "-f", "null", "-"], capture_output=True, text=True)
        times = re.findall(r"time=(\d+):(\d+):(\d+\.\d+)", p.stderr)
        if times:
            h, mi, s = times[-1]
            info["duration"] = int(h) * 3600 + int(mi) * 60 + float(s)
    return info


def normalize_video(src: Path, out: Path, max_side: int = 1920, fps: int = 30) -> Path:
    """Upright, constant-frame-rate H.264/AAC MP4.

    ffmpeg applies phone rotation metadata (OpenCV ignores it and would see the
    face sideways) and gives browser WebM recordings a real duration + fps.
    """
    box = f"scale='if(gt(iw,ih),min({max_side},iw),-2)':'if(gt(iw,ih),-2,min({max_side},ih))'"
    ffmpeg("-i", src, "-vf", f"{box},fps={fps},format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
           "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart", out)
    return out


def extract_clean_audio(video: Path, out_wav: Path, sample_rate: int = 22050) -> Path:
    """Mono speech track: high-pass rumble, FFT denoise, EBU R128 loudness normalisation."""
    ffmpeg(
        "-i", video, "-vn", "-ac", "1", "-ar", str(sample_rate),
        "-af", "highpass=f=80,lowpass=f=8000,afftdn=nf=-25,loudnorm=I=-18:TP=-1.5:LRA=11",
        out_wav,
    )
    return out_wav


def to_wav(audio: Path, out_wav: Path, sample_rate: int = 16000) -> Path:
    ffmpeg("-i", audio, "-vn", "-ac", "1", "-ar", str(sample_rate), out_wav)
    return out_wav


def cut(video: Path, out: Path, start: float, duration: float) -> Path:
    ffmpeg("-ss", f"{start:.3f}", "-i", video, "-t", f"{duration:.3f}", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", out)
    return out


def mux(video: Path, audio: Path, out: Path) -> Path:
    """Replace the video's audio track, trimming to the shorter stream."""
    ffmpeg("-i", video, "-i", audio, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", out)
    return out


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))
