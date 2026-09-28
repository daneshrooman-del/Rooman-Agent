"""Tavus-backed implementation of create_avatar / generate (no local GPU needed).

create:  validate + normalise the recording (Tavus: ≥1080p, ≥25 fps, H.264/AAC,
         30 s speaking + 30 s still) -> local identity anchor (for our own
         consistency check) -> temporary public link -> POST /v2/faces -> wait.
generate: POST /v2/videos (script, or audio via public link) -> wait -> download
         -> per-frame identity check against the anchor, same as local mode.
"""
from __future__ import annotations

import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import cv2
import numpy as np

from .. import identity, media, publish
from ..actions import resolve
from ..config import settings
from ..consistency import check_video
from . import tavus

TRAINING_STAGES = ["Analyzing video", "Extracting identity", "Uploading to Tavus", "Training your face", "Creating avatar"]
GENERATION_STAGES = ["Preparing your avatar", "Sending to Tavus", "Rendering video", "Checking identity consistency", "Finalizing video"]
MIN_SECONDS = 55  # 30 s speaking + 30 s still (small tolerance)
MAX_BYTES = 750 * 1024**2

Progress = Callable[[int, str], None]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _prepare_training_video(src: Path, out: Path) -> tuple[Path, list[str]]:
    info = media.probe(src)
    warnings: list[str] = []
    if not info["has_video"]:
        raise ValueError("The file has no video stream.")
    if not info["has_audio"]:
        raise ValueError("The recording has no audio — your voice is needed. Record with the microphone on.")
    if info["duration"] < MIN_SECONDS:
        raise ValueError(f"The recording is {info['duration']:.0f}s. Tavus needs about 1 minute: 30 seconds speaking, then 30 seconds sitting still.")
    short_side = min(info["width"], info["height"])
    scale = ""
    if short_side < 1080:
        warnings.append(f"Your camera recorded {short_side}p; Tavus asks for 1080p. It was upscaled, so the avatar may look softer — use a 1080p camera for best results.")
        scale = "scale=-2:1080:flags=lanczos," if info["height"] <= info["width"] else "scale=1080:-2:flags=lanczos,"
    media.ffmpeg(
        "-i", src, "-vf", f"{scale}fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", out,
    )
    if out.stat().st_size > MAX_BYTES:
        raise ValueError("The recording is over Tavus's 750 MB limit. Record a shorter clip (about 1 minute).")
    return out, warnings


def _anchor(video: Path) -> tuple[np.ndarray, np.ndarray]:
    """Mean identity embedding + best reference frame from ~40 samples."""
    cap = cv2.VideoCapture(str(video))
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    picks: list[tuple[float, np.ndarray, np.ndarray]] = []
    for i in np.linspace(0, n - 1, 40).astype(int):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(i))
        ok, frame = cap.read()
        if not ok:
            continue
        faces = identity.detect(frame)
        if len(faces) != 1:
            continue
        f = faces[0]
        score = identity.frontalness(f) * np.log1p(identity.sharpness(frame, f))
        picks.append((score, identity.embed(frame, f), frame))
    cap.release()
    if len(picks) < 5:
        raise ValueError("We couldn't see one clear face in most of the recording. Face the camera in good light, alone in frame.")
    embs = np.stack([p[1] for p in picks])
    anchor = embs.mean(axis=0)
    anchor /= np.linalg.norm(anchor) + 1e-9
    if min(float(np.dot(e, anchor)) for e in embs) < settings.identity_threshold:
        raise ValueError("The recording doesn't look like one person throughout. Only you should be in the video.")
    best = max(picks, key=lambda p: p[0])[2]
    return anchor, best


def build(video_file: Path, avatar_id: str, name: str | None, on_progress: Progress | None) -> str:
    d = settings.avatars_dir / avatar_id
    d.mkdir(parents=True, exist_ok=True)
    source = d / f"source{video_file.suffix.lower()}"
    shutil.copy2(video_file, source)
    manifest: dict = {
        "avatar_id": avatar_id, "provider": "tavus", "status": "training", "stage": 0, "stages": TRAINING_STAGES,
        "created_at": _now(), "source": {"file": video_file.name}, "warnings": [],
        "models": {"face_and_voice": f"Tavus {settings.tavus_model}", "identity": "OpenCV SFace (Apache-2.0)"},
    }
    mpath = d / "manifest.json"

    def stage(i: int, msg: str, progress: int | None = None) -> None:
        manifest.update(stage=i, message=msg)
        if progress is not None:
            manifest["training_progress"] = progress
        media.write_json(mpath, manifest)
        if on_progress:
            on_progress(i, msg)

    media.write_json(mpath, manifest)
    try:
        stage(0, "Analyzing video")
        train, warnings = _prepare_training_video(source, d / "training.mp4")
        manifest["warnings"] += warnings

        stage(1, "Extracting identity")
        anchor, ref = _anchor(train)
        np.save(d / "identity.npy", anchor)
        cv2.imwrite(str(d / "reference.png"), ref)

        stage(2, "Uploading to Tavus")
        url = publish.publish(train)
        face_id = tavus.create_face(url, name or avatar_id)
        manifest["tavus_face_id"] = face_id
        media.write_json(mpath, manifest)

        stage(3, "Training your face", 0)
        face = tavus.wait_face(face_id, on_progress=lambda p: stage(3, f"Training your face · {p}%", p))
        publish.revoke(url)
        manifest["tavus"] = {k: face.get(k) for k in ("model_name", "default_voice_id", "thumbnail_image_url", "thumbnail_video_url", "finetune_status")}

        stage(4, "Creating avatar", 100)
        manifest.update(status="ready", ready_at=_now(), message="Ready")
        media.write_json(mpath, manifest)
        if on_progress:
            on_progress(len(TRAINING_STAGES), "Ready")
        return avatar_id
    except Exception as e:
        manifest.update(status="failed", error=str(e))
        media.write_json(mpath, manifest)
        raise


def render(avatar_id: str, script_or_audio: str | Path, action_type: str, manifest: dict, out: Path, on_progress: Progress | None) -> tuple[Path, dict]:
    from ..generate import MAX_SCRIPT_CHARS, ConsistencyError, is_audio_input

    def stage(i: int) -> None:
        if on_progress:
            on_progress(i, GENERATION_STAGES[i])

    stage(0)
    action, spec = resolve(action_type)
    d = settings.avatars_dir / avatar_id
    face_id = manifest["tavus_face_id"]

    stage(1)
    audio_url = None
    if is_audio_input(script_or_audio):
        audio_url = publish.publish(Path(script_or_audio))
        video_id = tavus.create_video(face_id, audio_url=audio_url, name=f"{avatar_id} {action.value}")
    else:
        text = str(script_or_audio or "").strip() or (spec.default_script or "")
        if not text:
            raise ValueError("Provide a script (text) or an audio file path.")
        if len(text) > MAX_SCRIPT_CHARS:
            raise ValueError(f"Script is {len(text)} characters — keep it under {MAX_SCRIPT_CHARS}.")
        video_id = tavus.create_video(face_id, script=text, name=f"{avatar_id} {action.value}")

    stage(2)
    v = tavus.wait_video(video_id)
    if audio_url:
        publish.revoke(audio_url)
    work = settings.outputs_dir / ".work" / f"tavus_{uuid.uuid4().hex[:8]}"
    work.mkdir(parents=True)
    try:
        raw = tavus.download(v["download_url"], work / "tavus.mp4")

        stage(3)
        report = check_video(raw, np.load(d / "identity.npy"), stride=2).to_dict()
        report.update(avatar_id=avatar_id, action=action.value, provider="tavus", tavus_video_id=video_id, hosted_url=v.get("hosted_url"))
        if report["verdict"] == "rejected":
            quarantine = settings.outputs_dir / "rejected" / out.name
            quarantine.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(raw), quarantine)
            media.write_json(quarantine.with_suffix(".consistency.json"), report)
            raise ConsistencyError(f"Rejected: {report['reason']}", report, quarantine)

        stage(4)
        shutil.move(str(raw), out)
        media.write_json(out.with_suffix(".consistency.json"), report)
        return out, report
    finally:
        shutil.rmtree(work, ignore_errors=True)
