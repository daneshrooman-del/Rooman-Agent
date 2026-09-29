"""Stage 3 + 4 — render an action with the twin, then verify identity."""
from __future__ import annotations

import re
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
_TQDM = re.compile(r"(Face Renderer|seamlessClone):+\s*(\d+)%")


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
    out = Path(out_path) if out_path else settings.outputs_dir / f"{avatar_id}_{action.value}_{job}.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    if manifest.get("provider") == "tavus":
        from .providers import tavus_pipeline

        return tavus_pipeline.render(avatar_id, script_or_audio, action_type, manifest, out, on_progress)
    work = settings.outputs_dir / ".work" / job
    work.mkdir(parents=True)

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
            if not (d / "voice.pt").exists():  # face-only avatar: speak with the default stock voice
                from .photo_twin import use_stock_voice

                use_stock_voice(d / "voice.pt")
            with GPU_LOCK:
                run_worker(settings.xtts_python, "xtts_worker.py", {"op": "speak", "text": text, "language": language, "voice": d / "voice.pt", "out": speech}, env=_xtts_env())
        drive = media.to_wav(speech, work / "drive_16k.wav", 16000)  # SadTalker's audio encoder expects 16 kHz

        # motion: animate the twin's prepared 3D face with the speech
        stage(2)
        extra: dict = {}
        if settings.video_renderer == "magichour":
            extra = _render_magichour(d, speech, work, on_progress)
        else:
            prep = media.read_json(d / "sadtalker" / "prep.json")
            last = [-1]

            def motion_log(line: str) -> None:
                # SadTalker's tqdm bars: rendering is ~85% of the step, pasting back into the frame the rest
                m = _TQDM.search(line)
                if not m or not on_progress:
                    return
                pct = int(m.group(2))
                overall = round(pct * 0.85) if m.group(1) == "Face Renderer" else 85 + round(pct * 0.15)
                if overall >= last[0] + 2:
                    last[0] = overall
                    on_progress(2, f"{GENERATION_STAGES[2]} · {overall}%")

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
                    on_log=motion_log,
                )
            media.mux(work / "raw.mp4", speech, work / "final.mp4")  # full-quality speech instead of the 16 kHz drive track

        # identity check on every frame
        stage(3)
        report = check_video(work / "final.mp4", np.load(d / "identity.npy")).to_dict()
        report.update(avatar_id=avatar_id, action=action.value, **extra)
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


def _render_magichour(d: Path, speech: Path, work: Path, on_progress: Callable[[int, str], None] | None) -> dict:
    """Magic Hour AI Talking Photo: the avatar's reference photo + speech -> talking video (no local GPU)."""
    from .providers import magichour as mh

    mode = settings.magichour_mode
    seconds = media.probe(speech)["duration"]
    need = mh.estimate_credits(seconds, mode)
    have = mh.credits()
    if need > have:  # check before spending anything
        per_s = mh.CREDITS_PER_SECOND[mode]
        raise mh.NotEnoughCredits(
            f"This {seconds:.1f}s video needs about {need} Magic Hour credits but the account has {have}. "
            f"Shorten the script to about {max(1, have // per_s)} seconds or add credits."
        )
    if on_progress:
        on_progress(2, f"{GENERATION_STAGES[2]} · uploading")
    mp3 = work / "speech.mp3"
    media.ffmpeg("-i", speech, "-vn", "-ac", "1", "-ar", "44100", "-b:a", "128k", mp3)
    image_fp = mh.upload(d / "reference.png", "image")
    audio_fp = mh.upload(mp3, "audio")
    job = mh.create_talking_photo(image_fp, audio_fp, seconds, mode=mode, name=f"{d.name} talk")
    if on_progress:
        on_progress(2, f"{GENERATION_STAGES[2]} · rendering on Magic Hour")
    v = mh.wait_video(job["id"])
    mh.download(v["downloads"][0]["url"], work / "raw.mp4")
    media.mux(work / "raw.mp4", speech, work / "final.mp4")
    return {"renderer": "magichour", "magichour_video_id": job["id"], "credits_charged": v.get("credits_charged", job.get("credits_charged"))}
