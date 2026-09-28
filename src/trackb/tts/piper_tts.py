"""Self-hosted, open-source TTS backed by Piper (`piper-tts` on PyPI).

Piper (https://github.com/OHF-Voice/piper1-gpl) is a fast, CPU-friendly, ONNX-based neural TTS
engine with no per-call API cost and no vendor account -- it satisfies this project's
no-paid-vendor-APIs constraint the same way `faster-whisper` does for STT.

`pip install piper-tts` was run in this project's `.venv` and succeeded cleanly (piper-tts
1.8.0, pulling in `onnxruntime` and `pathvalidate`; no build step, no GPU needed). The API this
module is written against was confirmed directly against that installed package
(`inspect.signature`/`inspect.getsource` on `piper.PiperVoice`), not guessed from docs:

- `piper.PiperVoice.load(model_path, config_path=None, use_cuda=False) -> PiperVoice` loads a
  voice model. `model_path` is a `.onnx` file; `config_path` defaults to `<model_path>.json`
  alongside it when not given.
- `PiperVoice.synthesize(text, syn_config=None) -> Iterable[AudioChunk]` synthesizes one
  `AudioChunk` per sentence in `text` (a generator -- consumed eagerly here since one full
  utterance's worth of audio is needed before `SessionWorker.speak()` can publish it).
- `AudioChunk.audio_int16_bytes` is ready-made PCM16 mono bytes; `AudioChunk.sample_rate` is
  the *model's* native rate, not necessarily `trackb.tts.base.TTS_SAMPLE_RATE` -- see
  "Resampling" below.

Deploying a real voice model
-----------------------------
Piper voice models are not bundled with the `piper-tts` package. A real deployment must:

1. Download a `<voice>.onnx` file and its matching `<voice>.onnx.json` config from Piper's
   voice catalog (https://github.com/rhasspy/piper/blob/master/VOICES.md, mirrored on
   https://huggingface.co/rhasspy/piper-voices) into a path the worker process can read.
2. Set `TRACKB_TTS_VOICE_MODEL_PATH` (`Settings.tts_voice_model_path`) to that `.onnx` file's
   path.

If `tts_voice_model_path` is unset, or set but the file doesn't exist, `PiperTTSProvider`
raises `TTSConfigurationError` with a message naming the missing path -- the first time
`synthesize()` is actually called (the model is loaded lazily, so constructing the provider
itself never fails just because a model isn't deployed yet) -- rather than letting
`PiperVoice.load()` fail with a raw `FileNotFoundError` or an opaque onnxruntime traceback.

Resampling
----------
Piper voices are commonly trained at rates other than `TTS_SAMPLE_RATE` (16 kHz) -- 22050 Hz is
common for its medium-quality voices, and it varies per model. `RoomClient.publish_audio()`
tags published audio with its own fixed configured rate rather than reading one off the bytes
it's given (see `trackb.tts.base`'s module docstring), so every chunk is resampled to
`TTS_SAMPLE_RATE` here via simple linear interpolation (`_resample_pcm16`) before being
returned. That's adequate for intelligible speech, not archival audio quality; swap in a
higher-quality resampler (e.g. `scipy.signal.resample_poly`) later if quality becomes a concern
-- not done here to avoid adding a new dependency for this pass.

Timeout, no retry
-----------------
`synthesize()` wraps the blocking Piper call in `asyncio.wait_for(..., timeout=...)` -- a
hung/slow local model call still needs a bound, per this track's external-call convention, even
though it's local inference rather than network I/O. It deliberately does *not* retry on
failure (unlike `WhisperSTT`/`KnowledgeBaseStore`): a failure here is a bad/corrupt model load,
a bug in this wrapper, or an onnxruntime error -- not the kind of transient blip retrying a
network call recovers from -- and a live conversation needs its follow-up question spoken
promptly rather than spending several more seconds retrying a failure that will just recur (see
`mint_join_token`'s docstring in `session/livekit_admin.py` for the same style of judgement
call, made the other way, for a call that genuinely can't fail transiently at all).

Unit tests never load a real model or run real inference: `PiperTTSProvider` accepts an
injected `voice=` satisfying `PiperVoiceProtocol` (mirroring how `WhisperSTT` accepts an
injected `model=`), so tests exercise the resampling/timeout/error-wrapping logic against a
fake voice object instead.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any, Protocol, cast

import numpy as np
import numpy.typing as npt
import structlog

from trackb.config import Settings, get_settings
from trackb.tts.base import TTS_SAMPLE_RATE
from trackb.tts.errors import TTSConfigurationError, TTSSynthesisError

logger = structlog.get_logger(__name__)

DEFAULT_SYNTHESIS_TIMEOUT_SECONDS = 10.0


class PiperAudioChunkProtocol(Protocol):
    """The slice of `piper.voice.AudioChunk` this wrapper depends on."""

    sample_rate: int

    @property
    def audio_int16_bytes(self) -> bytes: ...


class PiperVoiceProtocol(Protocol):
    """The slice of `piper.PiperVoice` this wrapper depends on."""

    def synthesize(self, text: str, syn_config: Any = None) -> Any: ...


def _load_piper_voice(model_path: str) -> PiperVoiceProtocol:
    try:
        from piper import PiperVoice
    except ImportError as exc:  # pragma: no cover - only hit without the dep installed
        raise RuntimeError(
            "piper-tts is not installed. Install project dependencies, or pass `voice=` "
            "explicitly (as tests do) to avoid needing the real package."
        ) from exc

    path = Path(model_path)
    if not path.is_file():
        raise TTSConfigurationError(
            f"Piper voice model not found at {model_path!r}. Set TRACKB_TTS_VOICE_MODEL_PATH "
            "to a downloaded .onnx voice model file (with its .onnx.json config alongside it) "
            "-- see trackb.tts.piper_tts's module docstring for where to get one."
        )
    return cast(PiperVoiceProtocol, PiperVoice.load(str(path)))


def _resample_pcm16(audio_bytes: bytes, orig_sample_rate: int, target_sample_rate: int) -> bytes:
    """Linear-interpolation resample of PCM16 mono `audio_bytes` to `target_sample_rate`."""
    if orig_sample_rate == target_sample_rate or not audio_bytes:
        return audio_bytes

    samples: npt.NDArray[np.int16] = np.frombuffer(audio_bytes, dtype=np.int16)
    duration_seconds = len(samples) / orig_sample_rate
    target_length = max(1, round(duration_seconds * target_sample_rate))

    orig_indices = np.arange(len(samples), dtype=np.float64)
    target_indices = np.linspace(0, len(samples) - 1, num=target_length)
    resampled = np.interp(target_indices, orig_indices, samples.astype(np.float64))
    return cast(bytes, resampled.astype(np.int16).tobytes())


class PiperTTSProvider:
    """`TTSProvider` backed by a locally-loaded Piper voice model.

    Pass `voice=` (anything satisfying `PiperVoiceProtocol`) to inject a fake in tests;
    otherwise a real `piper.PiperVoice` is lazily loaded from `Settings.tts_voice_model_path` on
    first use.
    """

    def __init__(
        self,
        *,
        settings: Settings | None = None,
        voice: PiperVoiceProtocol | None = None,
        synthesis_timeout_seconds: float = DEFAULT_SYNTHESIS_TIMEOUT_SECONDS,
    ) -> None:
        settings = settings or get_settings()
        self._model_path = settings.tts_voice_model_path
        self._voice = voice
        self._synthesis_timeout_seconds = synthesis_timeout_seconds

    def _ensure_voice(self) -> PiperVoiceProtocol:
        if self._voice is None:
            if not self._model_path:
                raise TTSConfigurationError(
                    "TRACKB_TTS_VOICE_MODEL_PATH is not set -- PiperTTSProvider has no voice "
                    "model to load. See trackb.tts.piper_tts's module docstring for how to "
                    "download one and configure it."
                )
            self._voice = _load_piper_voice(self._model_path)
        return self._voice

    async def synthesize(self, text: str, voice_id: str | None = None) -> bytes:
        if not text.strip():
            return b""

        if voice_id is not None:
            # Piper addresses voices as separate model files (or, for a multi-speaker model, an
            # integer speaker index) -- neither maps cleanly onto trackb's string `voice_id`
            # (AgentSpec.voice_id / AvatarAssignment.voice_id) yet. This provider always speaks
            # with whichever single model `tts_voice_model_path` points at; reconciling that
            # with per-agent voice selection is future work once a real voice-assignment flow
            # exists (see `AvatarAssignment`'s docstring in `trackb.provisioning.interfaces`).
            logger.debug("piper_tts_voice_id_ignored", voice_id=voice_id)

        try:
            return await asyncio.wait_for(
                asyncio.to_thread(self._synthesize_sync, text),
                timeout=self._synthesis_timeout_seconds,
            )
        except asyncio.TimeoutError as exc:
            logger.error("tts_synthesis_timed_out", timeout=self._synthesis_timeout_seconds)
            raise TTSSynthesisError(
                f"Piper synthesis timed out after {self._synthesis_timeout_seconds}s"
            ) from exc
        except TTSConfigurationError:
            raise
        except Exception as exc:
            logger.error("tts_synthesis_failed", error=str(exc))
            raise TTSSynthesisError(f"Piper synthesis failed: {exc}") from exc

    def _synthesize_sync(self, text: str) -> bytes:
        voice = self._ensure_voice()
        chunks = list(voice.synthesize(text))
        resampled = [
            _resample_pcm16(chunk.audio_int16_bytes, chunk.sample_rate, TTS_SAMPLE_RATE)
            for chunk in chunks
        ]
        audio = b"".join(resampled)
        logger.info("tts_synthesized", text_length=len(text), audio_bytes=len(audio))
        return audio
