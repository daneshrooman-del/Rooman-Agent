"""Load the speech models once per job process, before any job is assigned to it.

LiveKit runs each session in its own process. Without this, Whisper, the Piper voice and Silero
are loaded lazily inside the first turn of every session -- measured at ~5 s for Whisper and
~3 s for Piper on the dev machine, all of it added to the first reply's latency. LiveKit calls
`prewarm` (via `WorkerOptions(prewarm_fnc=...)`) in idle processes ahead of time; the entrypoints
read the loaded models back from `JobProcess.userdata`.

Each model also runs one tiny inference here: ctranslate2/onnxruntime do extra lazy setup on the
first call, which would otherwise still land in the first turn.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any

import numpy as np
import structlog

from trackb.config import Settings, get_settings

logger = structlog.get_logger(__name__)

USERDATA_KEY = "trackb_models"



@dataclass
class WarmModels:
    whisper: Any | None = None
    piper_voice: Any | None = None
    vad_session: Any | None = None
    face_renderer: Any | None = None


_cache_lock = threading.Lock()
_cached: WarmModels | None = None


def load_models(settings: Settings) -> WarmModels:
    from faster_whisper.vad import get_vad_model

    from trackb.stt.whisper_stt import _load_faster_whisper_model
    from trackb.tts.piper_tts import _load_piper_voice

    models = WarmModels()
    started = time.perf_counter()

    models.whisper = _load_faster_whisper_model(
        settings.whisper_model_size, settings.whisper_device, settings.whisper_compute_type
    )
    segments, _ = models.whisper.transcribe(
        np.zeros(16_000, dtype=np.float32), language=settings.whisper_language or "en"
    )
    list(segments)

    if settings.tts_voice_model_path:
        models.piper_voice = _load_piper_voice(settings.tts_voice_model_path)
        for _ in models.piper_voice.synthesize("Warm up."):
            pass

    models.vad_session = get_vad_model().session

    if settings.avatar_renderer == "musetalk":
        # Tens of seconds and several GB of VRAM: load once per worker, shared by sessions.
        models.face_renderer = build_musetalk_renderer(settings)

    if settings.llm_provider == "gemini":
        # The google-genai SDK takes ~2.7 s to import (measured on Kaggle); done lazily it blocks
        # the event loop during the first turn of the first session.
        import trackb.llm.gemini  # noqa: F401

    logger.info("models_prewarmed", seconds=round(time.perf_counter() - started, 2))
    return models


def shared_models(settings: Settings) -> WarmModels:
    """Load the models at most once per process and share them.

    With the thread job executor every session runs in the same process, so this is what makes
    all sessions share one Whisper/Piper/Silero (one copy in RAM -- or in VRAM on a GPU host)
    instead of each loading its own. The models are only used for inference, which faster-whisper
    and onnxruntime allow concurrently."""
    global _cached
    with _cache_lock:
        if _cached is None:
            _cached = load_models(settings)
        return _cached


def build_musetalk_renderer(settings: Settings) -> Any:
    from trackb.avatar.musetalk import MuseTalkRenderer

    if not settings.musetalk_dir or not settings.musetalk_avatar_dir:
        raise ValueError(
            "TRACKB_AVATAR_RENDERER=musetalk needs TRACKB_MUSETALK_DIR and "
            "TRACKB_MUSETALK_AVATAR_DIR"
        )
    return MuseTalkRenderer.load(
        musetalk_dir=settings.musetalk_dir,
        avatar_dir=settings.musetalk_avatar_dir,
        devices=settings.musetalk_devices,
        decoder=settings.musetalk_decoder,
        fps=settings.avatar_fps,
        batch_size=settings.musetalk_batch_size,
        output_size=settings.avatar_output_size,
        framing=settings.avatar_framing,
    )


def prewarm(proc: Any) -> None:
    """`WorkerOptions.prewarm_fnc`. Failures are logged, not raised: the entrypoints fall back to
    lazy loading, so a prewarm problem costs latency, not the session."""
    try:
        proc.userdata[USERDATA_KEY] = shared_models(get_settings())
    except Exception as exc:
        logger.error("models_prewarm_failed", error=str(exc))


def warm_models(ctx: Any) -> WarmModels:
    """The models `prewarm` loaded into this job's process, or an empty set (lazy loading)."""
    proc = getattr(ctx, "proc", None)
    userdata = getattr(proc, "userdata", None) or {}
    models = userdata.get(USERDATA_KEY)
    if isinstance(models, WarmModels):
        return models
    return _cached or WarmModels()
