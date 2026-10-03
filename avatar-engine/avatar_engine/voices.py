"""Voice library: named XTTS-v2 voices built from reference clips.

Drop `<Name>_FineTuned.wav` (or any `<Name>.wav`, ≥6 s of clean speech) into the voices
folder (default: <repo>/XTTS_Final, override with AVATAR_ENGINE_VOICES_DIR). Each clip is
turned into cached XTTS conditioning latents under data/voices/ — once, in a single model
load — and can then be used by generate(..., voice="<id>").
"""
from __future__ import annotations

import os
import re
from pathlib import Path

from . import media
from .config import ROOT, settings
from .twin import GPU_LOCK, _xtts_env
from .workers.runner import run_worker

AUDIO = {".wav", ".mp3", ".flac", ".m4a", ".ogg"}


def voices_dir() -> Path:
    return Path(os.environ.get("AVATAR_ENGINE_VOICES_DIR", ROOT.parent / "XTTS_Final"))


def _cache() -> Path:
    return settings.data_dir / "voices"


def _slug(stem: str) -> tuple[str, str]:
    """'Shalya_FineTuned' -> ('shalya', 'Shalya')"""
    name = re.sub(r"[_\-\s]*fine[_\-\s]*tuned$", "", stem, flags=re.I).strip("_- ") or stem
    name = name[:1].upper() + name[1:]
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"), name


def sources() -> dict[str, dict]:
    d = voices_dir()
    out: dict[str, dict] = {}
    if d.is_dir():
        for f in sorted(d.iterdir()):
            if f.suffix.lower() in AUDIO:
                vid, name = _slug(f.stem)
                out[vid] = {"id": vid, "name": name, "file": f}
    return out


def list_voices() -> list[dict]:
    """[{id, name, ready}] — ready means the latents are cached and usable right away."""
    return [{"id": v["id"], "name": v["name"], "ready": (_cache() / f"{v['id']}.pt").exists()} for v in sources().values()]


def prepare(ids: list[str] | None = None) -> dict:
    """Build latents for voices that aren't cached yet (one XTTS model load for all)."""
    src = sources()
    todo = [v for v in src.values() if (ids is None or v["id"] in ids) and not (_cache() / f"{v['id']}.pt").exists()]
    if not todo:
        return {"done": [], "failed": {}}
    _cache().mkdir(parents=True, exist_ok=True)
    items = []
    for v in todo:
        wav = v["file"]
        if media.probe(wav)["duration"] < settings.min_voice_seconds:
            continue
        items.append({"id": v["id"], "wav": wav, "out": _cache() / f"{v['id']}.pt"})
    with GPU_LOCK:
        return run_worker(settings.xtts_python, "xtts_worker.py", {"op": "clone_many", "items": items}, env=_xtts_env(), timeout=3600)


def latents_path(voice_id: str) -> Path:
    """Cached latents for a voice id, preparing it on first use."""
    src = sources()
    if voice_id not in src:
        raise ValueError(f"Unknown voice '{voice_id}'. Available: {', '.join(src) or 'none (voices folder is empty)'}")
    p = _cache() / f"{voice_id}.pt"
    if not p.exists():
        r = prepare([voice_id])
        if voice_id in r.get("failed", {}):
            raise ValueError(f"Voice '{voice_id}' could not be prepared: {r['failed'][voice_id]}")
    if not p.exists():
        raise ValueError(f"Voice '{voice_id}' has under {settings.min_voice_seconds:.0f} s of audio.")
    return p


def match_for_name(name: str | None) -> str | None:
    """Voice whose name matches an avatar's name (e.g. avatar 'Shalya' -> voice 'shalya')."""
    if not name:
        return None
    first = re.split(r"\s+", name.strip())[0].lower()
    return next((vid for vid, v in sources().items() if v["name"].lower() == first), None)
