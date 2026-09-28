"""Stage 3 + 4 — render an action with the twin, then verify identity."""
from __future__ import annotations

import shutil
import uuid
from pathlib import Path
from typing import Callable

import numpy as np

from . import media
from .actions import resolve
from .config import settings
from .consistency import check_video
from .twin import GPU_LOCK, _xtts_env, avatar_dir, load_manifest
from .workers.runner import run_worker

GENERATION_STAGES = ["Preparing your avatar", "Generating speech", "Generating motion", "Checking identity consistency", "Finalizing video"]
MAX_SCRIPT_CHARS = 3000


class AvatarNotReady(RuntimeError):
    pass


class ConsistencyError(RuntimeError):
    """The render drifted away from the twin's identity and was rejected."""

    def __init__(self, message: str, report: dict, quarantined: Path):
        super().__init__(message)
        self.report = report
        self.quarantined = quarantined


def is_audio_input(value: str | Path) -> bool:
    p = Path(str(value))
    return p.suffix.lower() in media.AUDIO_EXTS and p.exists()


def render(
    avatar_id: str,
    script_or_audio: str | Path,
    action_type: str,
    *,
    language: str = "en",
    out_path: Path | None = None,
    on_progress: Callable[[int, str], None] | None = None,
) -> tuple[Path, dict]:
    def stage(i: int) -> None:
        if on_progress:
            on_progress(i, GENERATION_STAGES[i])

    stage(0)
    action, spec = resolve(action_type)
    d = avatar_dir(avatar_id)
    manifest = load_manifest(avatar_id)
    if manifest["status"] != "ready":
        raise AvatarNotReady(f"Avatar {avatar_id} is {manifest['status']}" + (f": {manifest.get('error')}" if manifest.get("error") else ""))

    job = f"gen_{uuid.uuid4().hex[:10]}"
    work = settings.outputs_dir / ".work" / job
    work.mkdir(parents=True)
    out = Path(out_path) if out_path else settings.outputs_dir / f"{avatar_id}_{action.value}_{job}.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)

    try:
        # speech: user audio, or the script spoken in the twin's cloned voice
        stage(1)
        if is_audio_input(script_or_audio):
            speech = Path(script_or_audio)
        else:
            text = str(script_or_audio or "").strip() or (spec.default_script or "")
            if not text:
                raise ValueError("Provide a script (text) or an audio file path.")
            if len(text) > MAX_SCRIPT_CHARS:
                raise ValueError(f"Script is {len(text)} characters — keep it under {MAX_SCRIPT_CHARS}.")
            speech = work / "speech.wav"
            with GPU_LOCK:
                run_worker(settings.xtts_python, "xtts_worker.py", {"op": "speak", "text": text, "language": language, "voice": d / "voice.pt", "out": speech}, env=_xtts_env())
        drive = media.to_wav(speech, work / "drive_16k.wav", 16000)  # SadTalker's audio encoder expects 16 kHz

        # motion: animate the twin's prepared 3D face with the speech
        stage(2)
        prep = media.read_json(d / "sadtalker" / "prep.json")
        with GPU_LOCK:
            run_worker(
                settings.sadtalker_python, "sadtalker_worker.py",
                {
                    "op": "render", "prep": prep, "prep_dir": d / "sadtalker", "image": d / "reference.png",
                    "audio": drive, "out": work / "raw.mp4", "work_dir": work / "st", "size": settings.render_size,
                    "preprocess": "full", "still": spec.still, "pose_style": spec.pose_style,
                    "use_ref_pose": spec.use_ref_pose and bool(prep.get("ref_coeff")), "expression_scale": spec.expression_scale,
                },
                cwd=settings.sadtalker_dir,
            )
        media.mux(work / "raw.mp4", speech, work / "final.mp4")  # full-quality speech instead of the 16 kHz drive track

        # identity check on every frame
        stage(3)
        report = check_video(work / "final.mp4", np.load(d / "identity.npy")).to_dict()
        report.update(avatar_id=avatar_id, action=action.value)
        if report["verdict"] == "rejected":
            quarantine = settings.outputs_dir / "rejected" / out.name
            quarantine.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(work / "final.mp4"), quarantine)
            media.write_json(quarantine.with_suffix(".consistency.json"), report)
            raise ConsistencyError(f"Rejected: {report['reason']}", report, quarantine)

        stage(4)
        shutil.move(str(work / "final.mp4"), out)
        media.write_json(out.with_suffix(".consistency.json"), report)
        return out, report
    finally:
        shutil.rmtree(work, ignore_errors=True)
