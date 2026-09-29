"""Paths and tunables. Every value can be overridden with an AVATAR_ENGINE_* env var."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader (KEY=VALUE lines). Real environment variables win."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv(ROOT / ".env")


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

    # "tavus" = hosted Tavus Phoenix API (no local GPU needed); "local" = SadTalker + XTTS-v2 on this machine.
    # Default: tavus when a TAVUS_API_KEY is configured.
    provider: str = field(default_factory=lambda: os.environ.get("AVATAR_ENGINE_PROVIDER", "tavus" if os.environ.get("TAVUS_API_KEY") else "local").lower())
    tavus_api_key: str = field(default_factory=lambda: os.environ.get("TAVUS_API_KEY", ""))
    tavus_model: str = field(default_factory=lambda: os.environ.get("TAVUS_MODEL", "phoenix-4.5"))
    # Where Tavus downloads training videos from. Empty = start a Cloudflare quick tunnel automatically.
    public_base_url: str = field(default_factory=lambda: os.environ.get("AVATAR_ENGINE_PUBLIC_URL", "").rstrip("/"))
    # Video renderer for local avatars: "magichour" (hosted Talking Photo, no GPU) or "sadtalker" (this machine).
    # Default: magichour when a MAGICHOUR_API_KEY is configured.
    magichour_api_key: str = field(default_factory=lambda: os.environ.get("MAGICHOUR_API_KEY", ""))
    video_renderer: str = field(default_factory=lambda: os.environ.get("AVATAR_ENGINE_VIDEO_RENDERER", "magichour" if os.environ.get("MAGICHOUR_API_KEY") else "sadtalker").lower())
    magichour_mode: str = field(default_factory=lambda: os.environ.get("MAGICHOUR_MODE", "realistic"))
    # Voice cloning at avatar creation is off for now: avatars are face-only and videos use a stock voice.
    clone_voice: bool = field(default_factory=lambda: os.environ.get("AVATAR_ENGINE_CLONE_VOICE") == "1")
    port: int = field(default_factory=lambda: int(os.environ.get("AVATAR_ENGINE_PORT", "8100")))

    @property
    def avatars_dir(self) -> Path:
        return self.data_dir / "avatars"

    @property
    def outputs_dir(self) -> Path:
        return self.data_dir / "outputs"


settings = Settings()
