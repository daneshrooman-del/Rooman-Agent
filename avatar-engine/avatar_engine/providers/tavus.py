"""Thin client for the Tavus v2 API (faces + video generation).

Docs: https://docs.tavus.io  ·  auth header: x-api-key
The key is read from TAVUS_API_KEY (avatar-engine/.env) and never leaves the server.
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Callable

import httpx

from ..config import settings

API = "https://tavusapi.com/v2"


class TavusError(RuntimeError):
    pass


class TavusPlanError(TavusError):
    """402 — the Tavus plan doesn't include this (e.g. custom face training on the free plan)."""


def _client() -> httpx.Client:
    if not settings.tavus_api_key:
        raise TavusError("TAVUS_API_KEY is not set (put it in avatar-engine/.env).")
    return httpx.Client(base_url=API, headers={"x-api-key": settings.tavus_api_key}, timeout=60)


def _check(r: httpx.Response) -> dict:
    if r.status_code >= 400:
        try:
            body = r.json()
            msg = body.get("message") or body.get("error") or r.text
        except Exception:
            msg = r.text
        cls = TavusPlanError if r.status_code == 402 else TavusError
        raise cls(f"Tavus {r.request.method} {r.request.url.path} failed ({r.status_code}): {msg}")
    return r.json() if r.content else {}


def _progress(value: str | None) -> int:
    """'42/100' -> 42"""
    try:
        done, total = str(value).split("/")
        return round(100 * float(done) / float(total))
    except Exception:
        return 0


def create_face(train_video_url: str, name: str) -> str:
    with _client() as c:
        body = {"train_video_url": train_video_url, "face_name": name, "model_name": settings.tavus_model}
        return _check(c.post("/faces", json=body))["face_id"]


def get_face(face_id: str) -> dict:
    with _client() as c:
        return _check(c.get(f"/faces/{face_id}"))


def wait_face(face_id: str, on_progress: Callable[[int], None] | None = None, timeout: float = 3600, poll: float = 10) -> dict:
    """Poll until the face is usable (status completed) or failed."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        f = get_face(face_id)
        status = f.get("status")
        if on_progress:
            on_progress(_progress(f.get("training_progress")))
        if status == "completed":
            return f
        if status == "error":
            raise TavusError(f"Tavus face training failed: {f.get('error_message') or 'unknown error'}")
        time.sleep(poll)
    raise TavusError("Tavus face training timed out.")


def create_video(face_id: str, *, script: str | None = None, audio_url: str | None = None, name: str = "Avatar video") -> str:
    body: dict = {"replica_id": face_id, "video_name": name}
    if audio_url:
        body["audio_url"] = audio_url
    else:
        body["script"] = script
    with _client() as c:
        return _check(c.post("/videos", json=body))["video_id"]


def get_video(video_id: str) -> dict:
    with _client() as c:
        return _check(c.get(f"/videos/{video_id}", params={"verbose": "true"}))


def wait_video(video_id: str, on_progress: Callable[[int], None] | None = None, timeout: float = 3600, poll: float = 8) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        v = get_video(video_id)
        status = v.get("status")
        if on_progress:
            on_progress(_progress(v.get("generation_progress")))
        if status == "ready" and v.get("download_url"):
            return v
        if status in ("error", "deleted"):
            raise TavusError(f"Tavus video failed: {v.get('status_details') or status}")
        time.sleep(poll)
    raise TavusError("Tavus video generation timed out.")


def download(url: str, out: Path) -> Path:
    with httpx.stream("GET", url, timeout=300, follow_redirects=True) as r:
        r.raise_for_status()
        with out.open("wb") as f:
            for chunk in r.iter_bytes(1 << 16):
                f.write(chunk)
    return out
