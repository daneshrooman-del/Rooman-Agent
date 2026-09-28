"""One-shot setup for the avatar engine (Windows or Linux).

Creates three isolated virtualenvs — the heavy models need mutually
incompatible library versions, and running them as separate worker
processes also frees GPU/RAM between pipeline steps:

  .venvs/engine     orchestrator: ingestion, identity check, API (no torch)
  .venvs/sadtalker  SadTalker animation + lip-sync worker
  .venvs/xtts       XTTS-v2 voice-cloning worker

and downloads every model checkpoint.

    py -3.10 scripts/setup.py            # everything
    py -3.10 scripts/setup.py --only models
    py -3.10 scripts/setup.py --cpu      # no CUDA torch wheels

Python 3.10 is required (SadTalker's pinned deps don't build on newer versions).
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENVS = ROOT / ".venvs"
THIRD = ROOT / "third_party"
SADTALKER = THIRD / "SadTalker"
SADTALKER_REPO = "https://github.com/OpenTalker/SadTalker.git"
SADTALKER_COMMIT = "cd4c0465ae0b54a6f85af57f5c65fec9fe23e7f8"
MODELS = ROOT / "models"

TORCH_VERSION = "2.1.2"  # SadTalker env
XTTS_TORCH_VERSION = "2.5.1"  # coqui-tts ≥0.27 needs torch ≥2.2 (+ transformers ≥4.57)
TORCHVISION_VERSION = "0.16.2"  # last torchvision line that still ships functional_tensor (needed by basicsr)
CUDA_INDEX = "https://download.pytorch.org/whl/cu118"

ST_RELEASE = "https://github.com/OpenTalker/SadTalker/releases/download/v0.0.2-rc"
DOWNLOADS: dict[Path, str] = {
    SADTALKER / "checkpoints/SadTalker_V0.0.2_256.safetensors": f"{ST_RELEASE}/SadTalker_V0.0.2_256.safetensors",
    SADTALKER / "checkpoints/mapping_00109-model.pth.tar": f"{ST_RELEASE}/mapping_00109-model.pth.tar",
    SADTALKER / "checkpoints/mapping_00229-model.pth.tar": f"{ST_RELEASE}/mapping_00229-model.pth.tar",
    SADTALKER / "gfpgan/weights/alignment_WFLW_4HG.pth": "https://github.com/xinntao/facexlib/releases/download/v0.1.0/alignment_WFLW_4HG.pth",
    SADTALKER / "gfpgan/weights/detection_Resnet50_Final.pth": "https://github.com/xinntao/facexlib/releases/download/v0.1.0/detection_Resnet50_Final.pth",
    SADTALKER / "gfpgan/weights/GFPGANv1.4.pth": "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth",
    SADTALKER / "gfpgan/weights/parsing_parsenet.pth": "https://github.com/xinntao/facexlib/releases/download/v0.2.2/parsing_parsenet.pth",
    # OpenCV Zoo face models (Apache-2.0) used for the identity/consistency check
    MODELS / "face_detection_yunet_2023mar.onnx": "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
    MODELS / "face_recognition_sface_2021dec.onnx": "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
}


def run(cmd: list[str], **kw) -> None:
    print("$", " ".join(str(c) for c in cmd), flush=True)
    subprocess.run([str(c) for c in cmd], check=True, **kw)


def venv_python(name: str) -> Path:
    base = VENVS / name
    return base / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def make_venv(name: str) -> Path:
    py = venv_python(name)
    if not py.exists():
        run([sys.executable, "-m", "venv", VENVS / name])
        run([py, "-m", "pip", "install", "-q", "--upgrade", "pip", "setuptools<70", "wheel"])
    return py


def torch_args(cpu: bool, extra: list[str], version: str = TORCH_VERSION) -> list[str]:
    pkgs = [f"torch=={version}", *extra]
    return pkgs if cpu else [*pkgs, "--index-url", CUDA_INDEX]


def setup_engine() -> None:
    py = make_venv("engine")
    run([py, "-m", "pip", "install", "-q", "-r", ROOT / "requirements/engine.txt"])
    run([py, "-m", "pip", "install", "-q", "-e", ROOT])


def setup_sadtalker(cpu: bool) -> None:
    if not SADTALKER.exists():
        THIRD.mkdir(parents=True, exist_ok=True)
        run(["git", "clone", SADTALKER_REPO, SADTALKER])
    run(["git", "-C", SADTALKER, "fetch", "-q", "--depth", "1", "origin", SADTALKER_COMMIT])
    run(["git", "-C", SADTALKER, "checkout", "-q", SADTALKER_COMMIT])
    py = make_venv("sadtalker")
    run([py, "-m", "pip", "install", "-q", *torch_args(cpu, [f"torchvision=={TORCHVISION_VERSION}"])])
    run([py, "-m", "pip", "install", "-q", "-r", ROOT / "requirements/sadtalker.txt"])
    # basicsr/gfpgan import torch in setup.py -> must build against the installed torch
    run([py, "-m", "pip", "install", "-q", "--no-build-isolation", "basicsr==1.4.2"])
    run([py, "-m", "pip", "install", "-q", "--no-deps", "gfpgan==1.3.8"])


def setup_xtts(cpu: bool) -> None:
    py = make_venv("xtts")
    run([py, "-m", "pip", "install", "-q", *torch_args(cpu, [f"torchaudio=={XTTS_TORCH_VERSION}"], XTTS_TORCH_VERSION)])
    # constrain torch so coqui-tts can't silently swap in a CPU/other build
    constraint = VENVS / "xtts-constraints.txt"
    constraint.write_text(f"torch=={XTTS_TORCH_VERSION}\ntorchaudio=={XTTS_TORCH_VERSION}\ntransformers<5\n")
    run([py, "-m", "pip", "install", "-q", "-r", ROOT / "requirements/xtts.txt", "-c", constraint])


def download_models() -> None:
    for dest, url in DOWNLOADS.items():
        if dest.exists() and dest.stat().st_size > 0:
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix(dest.suffix + ".part")
        print(f"downloading {dest.name} …", flush=True)
        urllib.request.urlretrieve(url, tmp)
        tmp.replace(dest)
    print("models ready", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", choices=["engine", "sadtalker", "xtts", "models"], action="append")
    ap.add_argument("--cpu", action="store_true", help="install CPU-only torch wheels")
    a = ap.parse_args()
    if sys.version_info[:2] != (3, 10):
        sys.exit("Run this with Python 3.10 (e.g. `py -3.10 scripts/setup.py`).")
    steps = a.only or ["engine", "models", "sadtalker", "xtts"]
    for step in steps:
        {"engine": setup_engine, "models": download_models, "sadtalker": lambda: setup_sadtalker(a.cpu), "xtts": lambda: setup_xtts(a.cpu)}[step]()
    print("setup complete:", ", ".join(steps))


if __name__ == "__main__":
    main()
