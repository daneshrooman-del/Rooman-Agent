"""Magic Hour API client — AI Talking Photo (photo + speech audio -> talking video).

Docs: https://docs.magichour.ai  ·  auth: Authorization: Bearer <MAGICHOUR_API_KEY>
Pricing (2026-09): talking photo 48 credits/s in `realistic` mode, 20 credits/s in `prompted`.
The key is read from avatar-engine/.env and never leaves the server.
"""
from __future__ import annotations

import math
import time
from pathlib import Path

import httpx

from ..config import settings

API = "https://api.magichour.ai"
CREDITS_PER_SECOND = {"realistic": 48, "prompted": 20}


class MagicHourError(RuntimeError):
    pass


class NotEnoughCredits(MagicHourError):
    pass


def _client() -> httpx.Client:
    if not settings.magichour_api_key:
        raise MagicHourError("MAGICHOUR_API_KEY is not set (put it in avatar-engine/.env).")
    return httpx.Client(base_url=API, headers={"Authorization": f"Bearer {settings.magichour_api_key}"}, timeout=60)


def _check(r: httpx.Response) -> dict:
    if r.status_code >= 400:
        try:
            msg = r.json().get("message") or r.text
        except Exception:
            msg = r.text
        cls = NotEnoughCredits if r.status_code == 402 else MagicHourError
        raise cls(f"Magic Hour {r.request.method} {r.request.url.path} failed ({r.status_code}): {msg}")
    return r.json() if r.content else {}


def credits() -> int:
    with _client() as c:
        return int(_check(c.get("/v1/account")).get("credits") or 0)


def estimate_credits(seconds: float, mode: str = "realistic") -> int:
    return math.ceil(seconds) * CREDITS_PER_SECOND[mode]


def upload(path: Path, kind: str) -> str:
    """Upload a local file to Magic Hour storage; returns its file_path for generation APIs."""
    ext = path.suffix.lower().lstrip(".")
    with _client() as c:
        item = _check(c.post("/v1/files/upload-urls", json={"items": [{"type": kind, "extension": ext}]}))["items"][0]
    with path.open("rb") as f:
        r = httpx.put(item["upload_url"], content=f.read(), timeout=300)
    if r.status_code >= 400:
        raise MagicHourError(f"Upload of {path.name} failed ({r.status_code})")
    return item["file_path"]


def create_talking_photo(image_fp: str, audio_fp: str, seconds: float, *, mode: str = "realistic", name: str = "Avatar video", max_resolution: int | None = None) -> dict:
    body: dict = {
        "name": name,
        "start_seconds": 0,
        "end_seconds": round(seconds, 2),
        "assets": {"image_file_path": image_fp, "audio_file_path": audio_fp},
        "style": {"generation_mode": mode},
    }
    if max_resolution:
        body["max_resolution"] = max_resolution
    with _client() as c:
        return _check(c.post("/v1/ai-talking-photo", json=body))


def get_video(video_id: str) -> dict:
    with _client() as c:
        return _check(c.get(f"/v1/video-projects/{video_id}"))


def wait_video(video_id: str, timeout: float = 1800, poll: float = 5) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        v = get_video(video_id)
        status = v.get("status")
        if status == "complete" and v.get("downloads"):
            return v
        if status in ("error", "canceled"):
            err = (v.get("error") or {}).get("message") or status
            raise MagicHourError(f"Magic Hour render failed: {err}")
        time.sleep(poll)
    raise MagicHourError("Magic Hour render timed out.")


def download(url: str, out: Path) -> Path:
    with httpx.stream("GET", url, timeout=300, follow_redirects=True) as r:
        r.raise_for_status()
        with out.open("wb") as f:
            for chunk in r.iter_bytes(1 << 16):
                f.write(chunk)
    return out
