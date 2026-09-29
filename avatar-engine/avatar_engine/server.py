"""HTTP wrapper around the stable interface (for Track C's platform / the web app).

  POST /avatars                    multipart `video` (+ `consent=true`)  -> 202 {avatar_id, status}
  GET  /avatars/{id}               manifest: status, stage, warnings, error
  GET  /avatars/{id}/reference     the twin's reference frame (PNG)
  POST /avatars/{id}/generate      form: action_type, language, and `script` or `audio` file
                                   -> 202 {job_id}            (async, poll the job)
                                   ?wait=true -> streams the MP4 when done (video_file_or_stream)
  GET  /jobs/{job_id}              status, stage, progress message, consistency report, error
  GET  /jobs/{job_id}/video        the finished MP4

Heavy work runs on a single background worker thread (one GPU job at a time).
"""
from __future__ import annotations

import shutil
import tempfile
import threading
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import api, media
from .config import settings
from .generate import GENERATION_STAGES, render
from .twin import TRAINING_STAGES as LOCAL_TRAINING_STAGES, build_twin, new_avatar_id
from .providers.tavus_pipeline import GENERATION_STAGES as TAVUS_GENERATION_STAGES, TRAINING_STAGES as TAVUS_TRAINING_STAGES

TRAINING_STAGES = TAVUS_TRAINING_STAGES if settings.provider == "tavus" else LOCAL_TRAINING_STAGES

app = FastAPI(title="Avatar Engine", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# local renders share one GPU; Tavus jobs are network-bound and can overlap
_pool = ThreadPoolExecutor(max_workers=4 if settings.provider == "tavus" else 1)
_jobs: dict[str, dict] = {}
_lock = threading.Lock()


def _save_upload(upload: UploadFile, suffix: str) -> Path:
    tmp = Path(tempfile.mkdtemp(prefix="upload_")) / f"upload{suffix}"
    with tmp.open("wb") as f:
        shutil.copyfileobj(upload.file, f)
    return tmp


@app.get("/health")
def health() -> dict:
    return {"ok": True, "provider": settings.provider, "tavus_key": bool(settings.tavus_api_key), "sadtalker": settings.sadtalker_python.exists(), "xtts": settings.xtts_python.exists()}


@app.post("/avatars", status_code=202)
def create(video: UploadFile = File(...), consent: bool = Form(False), name: str | None = Form(None)) -> dict:
    if not consent:
        raise HTTPException(400, "Consent is required: the person in the video must agree to having a digital twin created.")
    suffix = Path(video.filename or "video.mp4").suffix.lower() or ".mp4"
    path = _save_upload(video, suffix)
    avatar_id = new_avatar_id()
    queued = settings.avatars_dir / avatar_id
    queued.mkdir(parents=True)
    media.write_json(queued / "manifest.json", {"avatar_id": avatar_id, "status": "training", "stage": 0, "stages": TRAINING_STAGES, "message": "Queued"})

    def run() -> None:
        try:
            build_twin(path, avatar_id=avatar_id, name=name)
        finally:
            shutil.rmtree(path.parent, ignore_errors=True)

    _pool.submit(run)
    return {"avatar_id": avatar_id, "status": "training", "stages": TRAINING_STAGES}


@app.post("/avatars/photos", status_code=202)
def create_from_photos(
    photos: list[UploadFile] = File(...),
    voice: UploadFile | None = File(None),
    consent: bool = Form(False),
    name: str | None = Form(None),
) -> dict:
    """1–5 photos (+ optional voice clip) -> twin, trained locally."""
    from .photo_twin import PHOTO_STAGES, build_from_photos

    if not consent:
        raise HTTPException(400, "Consent is required: the person in the photos must agree to having a digital twin created.")
    if not 1 <= len(photos) <= 5:
        raise HTTPException(400, "Upload between 1 and 5 photos.")
    saved = [_save_upload(p, Path(p.filename or "photo.jpg").suffix.lower() or ".jpg") for p in photos]
    voice_path = _save_upload(voice, Path(voice.filename or "voice.wav").suffix.lower() or ".wav") if voice else None
    avatar_id = new_avatar_id()
    queued = settings.avatars_dir / avatar_id
    queued.mkdir(parents=True)
    media.write_json(queued / "manifest.json", {"avatar_id": avatar_id, "status": "training", "stage": 0, "stages": PHOTO_STAGES, "message": "Queued"})

    def run() -> None:
        try:
            build_from_photos(saved, voice_sample=voice_path, name=name, avatar_id=avatar_id)
        finally:
            for f in saved + ([voice_path] if voice_path else []):
                shutil.rmtree(f.parent, ignore_errors=True)

    _pool.submit(run)
    return {"avatar_id": avatar_id, "status": "training", "stages": PHOTO_STAGES}


@app.get("/avatars/{avatar_id}")
def get_avatar(avatar_id: str) -> dict:
    try:
        return api.get_avatar(avatar_id)
    except api.AvatarNotFound:
        # training was accepted but the worker hasn't written the manifest yet
        raise HTTPException(404, "Avatar not found (or still queued)")


@app.get("/avatars/{avatar_id}/reference")
def reference(avatar_id: str) -> FileResponse:
    p = settings.avatars_dir / avatar_id / "reference.png"
    if not p.exists():
        raise HTTPException(404, "No reference frame yet")
    return FileResponse(p, media_type="image/png")


@app.post("/avatars/{avatar_id}/generate", status_code=202, response_model=None)
def generate(
    avatar_id: str,
    action_type: str = Form("talk"),
    language: str = Form("en"),
    script: str | None = Form(None),
    audio: UploadFile | None = File(None),
    wait: bool = False,
):
    try:
        api.get_avatar(avatar_id)
    except api.AvatarNotFound:
        raise HTTPException(404, "Avatar not found")
    source: str | Path
    if audio is not None:
        source = _save_upload(audio, Path(audio.filename or "a.wav").suffix.lower() or ".wav")
    elif script and script.strip():
        source = script
    elif action_type != "greet":
        raise HTTPException(400, "Send `script` text or an `audio` file.")
    else:
        source = ""

    job_id = f"job_{uuid.uuid4().hex[:12]}"
    stages = TAVUS_GENERATION_STAGES if api.get_avatar(avatar_id).get("provider") == "tavus" else GENERATION_STAGES
    job = {"job_id": job_id, "avatar_id": avatar_id, "action_type": action_type, "status": "queued", "stage": 0, "stages": stages}
    with _lock:
        _jobs[job_id] = job

    def progress(i: int, msg: str) -> None:
        job.update(status="running", stage=i, message=msg)

    def run() -> Path:
        try:
            path, report = render(avatar_id, source, action_type, language=language, on_progress=progress)
            job.update(status="done", video=str(path), duration_sec=media.probe(path)["duration"], consistency=report, message="Done")
            return path
        except api.ConsistencyError as e:
            job.update(status="rejected", error=str(e), consistency=e.report)
            raise
        except Exception as e:
            job.update(status="failed", error=str(e))
            raise
        finally:
            if isinstance(source, Path):
                shutil.rmtree(source.parent, ignore_errors=True)

    fut: Future = _pool.submit(run)
    if not wait:
        return job
    try:
        path = fut.result()
    except (api.ActionNotSupported, ValueError) as e:
        raise HTTPException(422, str(e))
    except api.ConsistencyError as e:
        raise HTTPException(409, {"error": str(e), "consistency": e.report})
    return FileResponse(path, media_type="video/mp4", filename=path.name, headers={"X-Job-Id": job_id})


@app.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict:
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@app.get("/jobs/{job_id}/video")
def job_video(job_id: str) -> FileResponse:
    job = _jobs.get(job_id)
    if not job or job.get("status") != "done":
        raise HTTPException(404, "Video not ready")
    return FileResponse(job["video"], media_type="video/mp4", filename=Path(job["video"]).name)
