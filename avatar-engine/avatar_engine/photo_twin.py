"""Build a digital twin from 1–5 photos (no video needed). Free, runs locally.

  photos ──► one face per photo, same person across all (SFace)
         ├─► identity anchor = mean embedding of every photo (stronger drift check)
         ├─► best photo (sharp, frontal, large face) = the frame SadTalker animates
         └─► voice: cloned from an optional voice clip, else an XTTS-v2 stock voice

The result is a normal twin: generate(avatar_id, script, "talk") works unchanged.
Head motion is audio-driven (a photo has no motion to borrow).
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import cv2
import numpy as np

from . import identity, media
from .config import settings
from .twin import GPU_LOCK, _xtts_env, new_avatar_id
from .workers.runner import run_worker

PHOTO_STAGES = ["Checking photos", "Extracting identity", "Learning facial structure", "Creating avatar"]
PHOTO_STAGES_WITH_VOICE = ["Checking photos", "Extracting identity", "Learning facial structure", "Preparing voice", "Creating avatar"]
PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
DEFAULT_STOCK_VOICE = "Claribel Dervla"
MAX_SIDE = 1280

Progress = Callable[[int, str], None]


class PhotoError(ValueError):
    """The photos can't be used (message is user-facing)."""


def use_stock_voice(out: Path, speaker: str = DEFAULT_STOCK_VOICE) -> dict:
    """Write XTTS-v2 stock-speaker latents to `out` (fast: reads the small speakers file)."""
    with GPU_LOCK:
        r = run_worker(settings.xtts_python, "xtts_worker.py", {"op": "stock", "speaker": speaker, "out": out}, env=_xtts_env())
    return {"type": "stock", "speaker": r["speaker"]}


def _load(path: Path) -> np.ndarray:
    img = cv2.imdecode(np.fromfile(str(path), dtype=np.uint8), cv2.IMREAD_COLOR)  # unicode-safe on Windows
    if img is None:
        raise PhotoError(f"“{path.name}” isn't a readable image. Use JPG, PNG or WebP.")
    h, w = img.shape[:2]
    s = min(1.0, MAX_SIDE / max(h, w))
    return cv2.resize(img, (round(w * s) // 2 * 2, round(h * s) // 2 * 2), interpolation=cv2.INTER_AREA) if s < 1 else img


def build_from_photos(
    photos: list[Path],
    *,
    voice_sample: Path | None = None,
    stock_voice: str = DEFAULT_STOCK_VOICE,
    name: str | None = None,
    avatar_id: str | None = None,
    on_progress: Progress | None = None,
) -> str:
    photos = [Path(p) for p in photos]
    if not 1 <= len(photos) <= 5:
        raise PhotoError("Upload between 1 and 5 photos of the same person.")
    for p in photos:
        if not p.exists():
            raise FileNotFoundError(p)
        if p.suffix.lower() not in PHOTO_EXTS:
            raise PhotoError(f"“{p.name}” isn't a supported image. Use JPG, PNG or WebP.")

    avatar_id = avatar_id or new_avatar_id()
    d = settings.avatars_dir / avatar_id
    d.mkdir(parents=True, exist_ok=True)
    manifest: dict = {
        "avatar_id": avatar_id, "provider": "local", "source_type": "photos", "name": name,
        "status": "training", "stage": 0, "stages": PHOTO_STAGES_WITH_VOICE if (settings.clone_voice and voice_sample) else PHOTO_STAGES,
        "created_at": datetime.now(timezone.utc).isoformat(), "source": {"photos": [p.name for p in photos]}, "warnings": [],
        "models": {"animation": "SadTalker v0.0.2 (Apache-2.0)", "voice": "Coqui XTTS-v2 (CPML, non-commercial)", "identity": "OpenCV SFace (Apache-2.0)"},
    }
    mpath = d / "manifest.json"

    def stage(i: int, msg: str) -> None:
        manifest.update(stage=i, message=msg)
        media.write_json(mpath, manifest)
        if on_progress:
            on_progress(i, msg)

    media.write_json(mpath, manifest)
    try:
        # 1. every photo: exactly one clear face
        stage(0, "Checking photos")
        shots: list[tuple[np.ndarray, identity.Face]] = []
        for i, p in enumerate(photos):
            img = _load(p)
            cv2.imwrite(str(d / f"photo_{i + 1}.png"), img)
            faces = identity.detect(img)
            if not faces:
                raise PhotoError(f"No face found in “{p.name}”. Use a clear, front-facing photo in good light.")
            if len(faces) > 1 and faces[1].area > 0.25 * faces[0].area:
                raise PhotoError(f"“{p.name}” shows more than one person. Each photo must show only you.")
            h, w = img.shape[:2]
            if faces[0].area / (w * h) < 0.02:
                manifest["warnings"].append(f"The face in “{p.name}” is small — a closer photo gives a sharper avatar.")
            shots.append((img, faces[0]))

        # 2. same person in every photo -> identity anchor
        stage(1, "Extracting identity")
        embs = np.stack([identity.embed(img, f) for img, f in shots])
        anchor = embs.mean(axis=0)
        anchor /= np.linalg.norm(anchor) + 1e-9
        # pairwise, not vs. the mean: two photos of person A would otherwise outvote one of person B
        for i in range(len(embs)):
            for j in range(i + 1, len(embs)):
                if identity.similarity(embs[i], embs[j]) < settings.identity_threshold:
                    raise PhotoError(f"“{photos[j].name}” doesn't look like the same person as “{photos[i].name}”. All photos must show you.")
        np.save(d / "identity.npy", anchor)
        best = max(range(len(shots)), key=lambda i: identity.frontalness(shots[i][1]) * np.log1p(identity.sharpness(*shots[i])) * shots[i][1].area)
        cv2.imwrite(str(d / "reference.png"), shots[best][0])
        manifest["reference"] = {"photo": photos[best].name, "width": shots[best][0].shape[1], "height": shots[best][0].shape[0]}
        manifest["identity"] = {"frames": len(embs), "min_similarity": round(min(float(np.dot(e, anchor)) for e in embs), 3)}

        # 3. 3DMM fit of the chosen photo (reused by every render)
        stage(2, "Learning facial structure")
        with GPU_LOCK:
            prep = run_worker(
                settings.sadtalker_python, "sadtalker_worker.py",
                {"op": "prepare", "image": d / "reference.png", "out_dir": d / "sadtalker", "size": settings.render_size, "preprocess": "full"},
                cwd=settings.sadtalker_dir,
            )
        media.write_json(d / "sadtalker" / "prep.json", prep)

        # 4. voice (optional, off for now — videos fall back to a stock voice at render time)
        if settings.clone_voice and voice_sample:
            stage(3, "Preparing voice")
            cloned = False
            if voice_sample:
                try:
                    clean = media.extract_clean_audio(Path(voice_sample), d / "voice_clean.wav")
                    if media.probe(clean)["duration"] < settings.min_voice_seconds:
                        raise PhotoError(f"the clip has under {settings.min_voice_seconds:.0f} s of speech")
                    with GPU_LOCK:
                        run_worker(settings.xtts_python, "xtts_worker.py", {"op": "clone", "speaker_wav": clean, "out": d / "voice.pt"}, env=_xtts_env())
                    manifest["voice"] = {"type": "cloned"}
                    cloned = True
                except Exception as e:  # never block the avatar on the voice — fall back to a stock voice
                    manifest["warnings"].append(f"Couldn't clone the voice clip ({e}); a stock voice is used instead.")
            if not cloned:
                manifest["voice"] = use_stock_voice(d / "voice.pt", stock_voice)
                if not voice_sample:
                    manifest["warnings"].append(f"No voice clip was given, so the stock voice “{manifest['voice']['speaker']}” is used. Add a 10–30 s recording of yourself to use your own voice.")


        stage(len(manifest["stages"]) - 1, "Creating avatar")
        manifest.update(status="ready", ready_at=datetime.now(timezone.utc).isoformat(), message="Ready")
        media.write_json(mpath, manifest)
        if on_progress:
            on_progress(len(manifest["stages"]), "Ready")
        return avatar_id
    except Exception as e:
        manifest.update(status="failed", error=str(e))
        media.write_json(mpath, manifest)
        raise

