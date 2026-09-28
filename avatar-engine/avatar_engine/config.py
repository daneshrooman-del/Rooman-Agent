"""Paths and tunables. Every value can be overridden with an AVATAR_ENGINE_* env var."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _venv_python(name: str) -> Path:
    base = ROOT / ".venvs" / name
    return base / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def _env_path(key: str, default: Path) -> Path:
    return Path(os.environ.get(f"AVATAR_ENGINE_{key}", default))


def _env_float(key: str, default: float) -> float:
    return float(os.environ.get(f"AVATAR_ENGINE_{key}", default))


@dataclass(frozen=True)
class Settings:
    data_dir: Path = field(default_factory=lambda: _env_path("DATA_DIR", ROOT / "data"))
    models_dir: Path = field(default_factory=lambda: _env_path("MODELS_DIR", ROOT / "models"))
    sadtalker_dir: Path = field(default_factory=lambda: _env_path("SADTALKER_DIR", ROOT / "third_party" / "SadTalker"))
    sadtalker_python: Path = field(default_factory=lambda: _env_path("SADTALKER_PYTHON", _venv_python("sadtalker")))
    xtts_python: Path = field(default_factory=lambda: _env_path("XTTS_PYTHON", _venv_python("xtts")))

    # SFace cosine similarity: OpenCV's published same-person threshold is 0.363.
    identity_threshold: float = field(default_factory=lambda: _env_float("IDENTITY_THRESHOLD", 0.363))
    # Fraction of face-bearing frames that must match for a video to be accepted.
    min_match_ratio: float = field(default_factory=lambda: _env_float("MIN_MATCH_RATIO", 0.95))
    # Frames with no detectable face at all above this fraction -> reject.
    max_faceless_ratio: float = field(default_factory=lambda: _env_float("MAX_FACELESS_RATIO", 0.10))

    # Reference-video requirements (ingestion guardrails)
    min_video_seconds: float = 6.0
    min_voice_seconds: float = 6.0  # XTTS needs ≥6s of clean speech to clone well
    render_size: int = 256  # SadTalker 256 fits a 4 GB GPU; 512 needs more VRAM

    @property
    def avatars_dir(self) -> Path:
        return self.data_dir / "avatars"

    @property
    def outputs_dir(self) -> Path:
        return self.data_dir / "outputs"


settings = Settings()
