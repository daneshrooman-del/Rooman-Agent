"""THE STABLE INTERFACE — what Track B (agents) and Track C (platform) call.

    create_avatar(video_file) -> avatar_id
    generate(avatar_id, script_or_audio, action_type) -> video_file

Do not change these two signatures. New capabilities go in as optional
keyword-only arguments with defaults, so existing callers keep working.
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable

from .actions import ActionNotSupported, ActionType
from .consistency import ConsistencyReport
from .generate import AvatarNotReady, ConsistencyError, render
from .ingest import IngestError
from .twin import AvatarNotFound, build_twin, load_manifest
from .workers.runner import WorkerError

__all__ = [
    "create_avatar",
    "generate",
    "get_avatar",
    "ActionType",
    "ActionNotSupported",
    "AvatarNotFound",
    "AvatarNotReady",
    "ConsistencyError",
    "ConsistencyReport",
    "IngestError",
    "WorkerError",
]

ProgressFn = Callable[[int, str], None]


def create_avatar(video_file: str | Path, *, name: str | None = None, on_progress: ProgressFn | None = None) -> str:
    """Turn a reference video of one person into a reusable digital twin.

    The video must show one person, face visible, speaking (≥6 s; 1–3 min is best).
    Blocks until training finishes and returns the avatar_id.
    Provider (AVATAR_ENGINE_PROVIDER): "tavus" (hosted, needs TAVUS_API_KEY; the recording should be ~1 min:
    30 s speaking + 30 s still, 1080p) or "local" (SadTalker + XTTS-v2 on this machine).

    Raises IngestError (unusable footage — message is user-facing), WorkerError (model failure).
    """
    return build_twin(Path(video_file), on_progress=on_progress, name=name)


def generate(
    avatar_id: str,
    script_or_audio: str | Path,
    action_type: str | ActionType,
    *,
    language: str = "en",
    out_path: str | Path | None = None,
    on_progress: ProgressFn | None = None,
) -> Path:
    """Render the twin performing an action and return the MP4 path.

    script_or_audio: text to speak in the twin's cloned voice, or a path to an audio file.
    action_type: "talk" | "greet" (supported) · "gesture" | "walk" | "demonstrate" (raise ActionNotSupported).
    language: XTTS-v2 language code for scripts (en, hi, es, …).

    A `<video>.consistency.json` identity report is written next to the video.
    Raises ConsistencyError if the identity drifted too far (the file is quarantined, not returned).
    """
    path, _ = render(avatar_id, script_or_audio, action_type, language=language, out_path=Path(out_path) if out_path else None, on_progress=on_progress)
    return path


def get_avatar(avatar_id: str) -> dict:
    """Manifest for an avatar: status (training | ready | failed), stage, warnings, error."""
    return load_manifest(avatar_id)
