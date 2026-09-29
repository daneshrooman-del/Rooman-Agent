"""Stage 2 — avatar training: build the reusable digital twin.

A twin is a directory under data/avatars/<avatar_id>/:

  manifest.json       status, stages, warnings, provenance
  source.<ext>        the original upload
  reference.png       best single, sharp, frontal frame (≤1280 px) — what gets animated
  identity.npy        mean SFace embedding over the best frames — the identity anchor
  ref_motion.mp4      a few seconds of the person's own head motion + blinks
  voice_clean.wav     denoised, loudness-normalised speech from the upload
  voice.pt            XTTS-v2 speaker latents (the cloned voice)
  sadtalker/          3DMM fit of reference.png + ref_motion coefficients (reused by every render)
  landmarks.npz       per-sample face box, 468-pt face mesh, 33-pt body pose
  person_mask.png, background.png   segmentation of the reference frame + clean plate
"""
from __future__ import annotations

import shutil
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import cv2
import numpy as np

from . import identity, media
from .config import settings
from .ingest import IngestResult, ingest
from .workers.runner import run_worker

TRAINING_STAGES = ["Analyzing video", "Extracting identity", "Learning facial motion", "Preparing voice", "Creating avatar"]
MAX_REFERENCE_SIDE = 1280
MOTION_CLIP_SECONDS = 5.0

Progress = Callable[[int, str], None]  # (stage index, message)

# One heavy model job at a time — a 4 GB GPU can't hold two.
GPU_LOCK = threading.Lock()


class AvatarNotFound(KeyError):
    pass


def avatar_dir(avatar_id: str) -> Path:
    d = settings.avatars_dir / avatar_id
    if not (d / "manifest.json").exists():
        raise AvatarNotFound(avatar_id)
    return d


def load_manifest(avatar_id: str) -> dict:
    return media.read_json(avatar_dir(avatar_id) / "manifest.json")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _grab_frame(video: Path, t: float) -> np.ndarray:
    cap = cv2.VideoCapture(str(video))
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise RuntimeError(f"Could not read frame at {t:.2f}s")
    h, w = frame.shape[:2]
    scale = min(1.0, MAX_REFERENCE_SIDE / max(h, w))
    if scale < 1:
        frame = cv2.resize(frame, (round(w * scale) // 2 * 2, round(h * scale) // 2 * 2), interpolation=cv2.INTER_AREA)
    return frame


def _identity_anchor(ing: IngestResult, k: int = 15) -> tuple[np.ndarray, list[float]]:
    """Mean embedding of the best frames, spread across the video so one pose doesn't dominate."""
    ranked = sorted((s for s in ing.samples if s.score > 0), key=lambda s: s.score, reverse=True)
    chosen: list = []
    for s in ranked:
        if all(abs(s.t - c.t) > 1.0 for c in chosen):
            chosen.append(s)
        if len(chosen) == k:
            break
    embs = np.stack([identity.embed(s.frame, s.face) for s in chosen])
    anchor = embs.mean(axis=0)
    anchor /= np.linalg.norm(anchor) + 1e-9
    return anchor, [identity.similarity(e, anchor) for e in embs]


def _motion_window(ing: IngestResult) -> float:
    """Start of the steadiest face-visible window with some natural head motion."""
    ts = np.array([s.t for s in ing.samples])
    centers = np.array([[s.face.box[0] + s.face.box[2] / 2, s.face.box[1] + s.face.box[3] / 2] if s.face else [np.nan, np.nan] for s in ing.samples])
    best_t, best_cost = 0.0, np.inf
    for i, t0 in enumerate(ts):
        if t0 + MOTION_CLIP_SECONDS > ing.duration:
            break
        win = (ts >= t0) & (ts < t0 + MOTION_CLIP_SECONDS)
        c = centers[win]
        if np.isnan(c).any():
            continue
        motion = float(np.linalg.norm(np.diff(c, axis=0), axis=1).mean()) if len(c) > 1 else 0.0
        cost = abs(motion - 3.0)  # a little movement (≈3 px/sample at 640 wide) looks alive; big moves look erratic
        if cost < best_cost:
            best_t, best_cost = float(t0), cost
    return best_t


def new_avatar_id() -> str:
    return f"av_{uuid.uuid4().hex[:12]}"


def build_twin(video_file: Path, on_progress: Progress | None = None, *, avatar_id: str | None = None, name: str | None = None) -> str:
    video_file = Path(video_file)
    if not video_file.exists():
        raise FileNotFoundError(video_file)
    if video_file.suffix.lower() not in media.VIDEO_EXTS:
        raise ValueError(f"Unsupported video type '{video_file.suffix}'. Use one of: {', '.join(sorted(media.VIDEO_EXTS))}")

    avatar_id = avatar_id or new_avatar_id()
    fallback_note: str | None = None
    if settings.provider == "tavus":
        from .providers import tavus_pipeline
        from .providers.tavus import TavusPlanError

        try:
            return tavus_pipeline.build(video_file, avatar_id, name, on_progress)
        except TavusPlanError:
            # e.g. the free Tavus plan has no custom face trainings — train the twin locally instead
            fallback_note = "Your Tavus plan doesn't include custom face training, so this avatar was trained locally (free, slower)."
            if not settings.sadtalker_python.exists():
                raise
    d = settings.avatars_dir / avatar_id
    d.mkdir(parents=True, exist_ok=True)
    source = d / f"source{video_file.suffix.lower()}"
    shutil.copy2(video_file, source)
    manifest: dict = {
        "avatar_id": avatar_id,
        "status": "training",
        "stage": 0,
        "stages": TRAINING_STAGES,
        "created_at": _now(),
        "source": {"file": video_file.name},
        "provider": "local",
        "warnings": [fallback_note] if fallback_note else [],
        "models": {"animation": "SadTalker v0.0.2 (Apache-2.0)", "voice": "Coqui XTTS-v2 (CPML, non-commercial)", "identity": "OpenCV SFace (Apache-2.0)"},
    }
    mpath = d / "manifest.json"

    def stage(i: int, msg: str) -> None:
        manifest["stage"] = i
        manifest["message"] = msg
        media.write_json(mpath, manifest)
        if on_progress:
            on_progress(i, msg)

    media.write_json(mpath, manifest)
    try:
        # 1. Analyzing video
        stage(0, "Analyzing video")
        # upright + constant fps (phone rotation, browser WebM) before any frame is read
        clip = media.normalize_video(source, d / "normalized.mp4")
        ing = ingest(clip, d / "work")
        shutil.move(str(ing.audio_wav), d / "voice_clean.wav")
        manifest["source"].update(duration=ing.duration, fps=ing.fps, width=ing.width, height=ing.height)
        manifest["warnings"] += ing.warnings
        np.savez_compressed(
            d / "landmarks.npz",
            t=np.array([s.t for s in ing.samples]),
            face_box=np.array([s.face.box if s.face else (-1, -1, -1, -1) for s in ing.samples]),
            face_mesh=ing.face_mesh,
            pose=ing.pose,
        )
        cv2.imwrite(str(d / "person_mask.png"), ing.person_mask)
        cv2.imwrite(str(d / "background.png"), ing.background)

        # 2. Extracting identity
        stage(1, "Extracting identity")
        anchor, sims = _identity_anchor(ing)
        if min(sims) < settings.identity_threshold:
            raise ValueError("The best frames don't all look like the same person. Use footage of one person only.")
        np.save(d / "identity.npy", anchor)
        best = max(ing.samples, key=lambda s: s.score)
        reference = _grab_frame(clip, best.t)
        cv2.imwrite(str(d / "reference.png"), reference)
        ref_faces = identity.detect(reference)
        if not ref_faces or identity.similarity(identity.embed(reference, ref_faces[0]), anchor) < settings.identity_threshold:
            raise ValueError("Could not confirm the identity in the reference frame.")
        manifest["reference"] = {"t": best.t, "width": reference.shape[1], "height": reference.shape[0]}
        manifest["identity"] = {"frames": len(sims), "min_similarity": round(min(sims), 3)}

        # 3. Learning facial motion — 3DMM fit + the person's own head motion
        stage(2, "Learning facial motion")
        t0 = _motion_window(ing)
        media.cut(clip, d / "ref_motion.mp4", t0, min(MOTION_CLIP_SECONDS, ing.duration - t0))
        with GPU_LOCK:
            prep = run_worker(
                settings.sadtalker_python, "sadtalker_worker.py",
                {"op": "prepare", "image": d / "reference.png", "out_dir": d / "sadtalker", "size": settings.render_size, "preprocess": "full", "ref_video": d / "ref_motion.mp4"},
                cwd=settings.sadtalker_dir,
            )
        media.write_json(d / "sadtalker" / "prep.json", prep)

        # 4. Preparing voice
        stage(3, "Preparing voice")
        voice_len = media.probe(d / "voice_clean.wav")["duration"]
        if voice_len < settings.min_voice_seconds:
            raise ValueError(f"Only {voice_len:.1f}s of speech found — at least {settings.min_voice_seconds:.0f}s is needed to clone the voice.")
        with GPU_LOCK:
            run_worker(settings.xtts_python, "xtts_worker.py", {"op": "clone", "speaker_wav": d / "voice_clean.wav", "out": d / "voice.pt"}, env=_xtts_env())

        # 5. Creating avatar
        stage(4, "Creating avatar")
        shutil.rmtree(d / "work", ignore_errors=True)
        manifest.update(status="ready", ready_at=_now(), message="Ready")
        media.write_json(mpath, manifest)
        if on_progress:
            on_progress(len(TRAINING_STAGES), "Ready")
        return avatar_id
    except Exception as e:
        manifest.update(status="failed", error=str(e))
        media.write_json(mpath, manifest)
        raise


def _xtts_env() -> dict[str, str]:
    import os

    # Loading XTTS-v2 requires accepting the Coqui Public Model License (non-commercial).
    # The operator opts in once via AVATAR_ENGINE_ACCEPT_COQUI_CPML=1.
    return {"COQUI_TOS_AGREED": "1"} if os.environ.get("AVATAR_ENGINE_ACCEPT_COQUI_CPML") == "1" else {}
