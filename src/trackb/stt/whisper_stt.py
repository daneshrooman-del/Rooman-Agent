"""Streaming speech-to-text wrapper around faster-whisper.

Exposes a minimal, self-contained interface -- `push_audio()` to feed raw audio in, `events()`
to consume transcripts out -- rather than subclassing `livekit.agents.stt.STT` directly, so it
stays independently testable (mocked model, no LiveKit types involved) and usable outside a
LiveKit session (e.g. the intake graph could in principle transcribe pre-recorded audio, or
this could sit behind a different transport later). `trackb.stt.livekit_plugin.WhisperLiveKitSTT`
is the real `livekit.agents.stt.STT` adapter that registers this as an actual LiveKit STT
plugin, once `livekit-agents` was confirmed installed and its interface inspected -- see that
module for the reconciliation.

Audio in is assumed to be raw 16-bit signed PCM, mono, at `sample_rate` (LiveKit's own audio
frames are delivered in this shape). Chunks are buffered until `chunk_seconds` worth of audio
has accumulated (or `flush()` is called -- e.g. on end-of-utterance from an upstream VAD/turn
detector), then handed to the blocking faster-whisper model on a worker thread.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Protocol

import numpy as np
import numpy.typing as npt
import structlog
from tenacity import AsyncRetrying, stop_after_attempt, wait_exponential

from trackb.config import Settings, get_settings
from trackb.stt.errors import TranscriptionError

logger = structlog.get_logger(__name__)

DEFAULT_SAMPLE_RATE = 16_000
_PCM16_MAX_ABS_VALUE = 32_768.0


@dataclass(frozen=True)
class TranscriptEvent:
    text: str
    is_final: bool
    language: str | None = None


class WhisperModelProtocol(Protocol):
    """The slice of `faster_whisper.WhisperModel` this wrapper depends on."""

    def transcribe(self, audio: Any, **kwargs: Any) -> tuple[Any, Any]: ...


def _load_faster_whisper_model(model_size: str, device: str, compute_type: str) -> Any:
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:  # pragma: no cover - only hit without the dep installed
        raise RuntimeError(
            "faster-whisper is not installed. Install project dependencies, or pass "
            "`model=` explicitly (as tests do) to avoid needing the real package."
        ) from exc
    return WhisperModel(model_size, device=device, compute_type=compute_type)


def _pcm16_bytes_to_float32(audio_bytes: bytes) -> npt.NDArray[np.float32]:
    samples = np.frombuffer(audio_bytes, dtype=np.int16)
    return (samples.astype(np.float32) / _PCM16_MAX_ABS_VALUE).astype(np.float32)


class WhisperSTT:
    """Buffers pushed audio and transcribes it with faster-whisper.

    Pass `model=` (anything satisfying `WhisperModelProtocol`) to inject a fake/mock model in
    tests; otherwise a real `faster_whisper.WhisperModel` is lazily constructed from
    `Settings.whisper_model_size` on first use.
    """

    def __init__(
        self,
        *,
        settings: Settings | None = None,
        model: WhisperModelProtocol | None = None,
        device: str = "cpu",
        compute_type: str = "int8",
        sample_rate: int = DEFAULT_SAMPLE_RATE,
        chunk_seconds: float = 2.0,
        transcribe_timeout_seconds: float = 10.0,
        max_attempts: int = 3,
        language: str | None = None,
    ) -> None:
        settings = settings or get_settings()
        self._model_size = settings.whisper_model_size
        self._device = device
        self._compute_type = compute_type
        self._sample_rate = sample_rate
        self._chunk_bytes = max(1, int(chunk_seconds * sample_rate * 2))  # 2 bytes/sample (PCM16)
        self._transcribe_timeout_seconds = transcribe_timeout_seconds
        self._max_attempts = max_attempts
        self._language = language

        self._model = model
        self._buffer = bytearray()
        self._queue: asyncio.Queue[TranscriptEvent] = asyncio.Queue()
        self._closed = False
        self._lock = asyncio.Lock()

    @property
    def model_size(self) -> str:
        return self._model_size

    def _ensure_model(self) -> WhisperModelProtocol:
        if self._model is None:
            self._model = _load_faster_whisper_model(
                self._model_size, self._device, self._compute_type
            )
        return self._model

    async def transcribe_utterance(self, audio_bytes: bytes) -> str:
        """Transcribe one complete utterance's raw PCM16 bytes directly, bypassing the
        streaming buffer.

        Used by `trackb.stt.livekit_plugin.WhisperLiveKitSTT`, where livekit-agents' own
        VAD-driven `StreamAdapter` hands over one already-segmented utterance at a time rather
        than raw frames -- so there's nothing to buffer, but the same retry/timeout wrapping
        still applies.
        """
        return await self._run_transcription(audio_bytes)

    async def push_audio(self, chunk: bytes) -> None:
        if self._closed:
            raise RuntimeError("WhisperSTT is closed; cannot push more audio")
        async with self._lock:
            self._buffer.extend(chunk)
            if len(self._buffer) >= self._chunk_bytes:
                await self._transcribe_buffered(is_final=False)

    async def flush(self) -> None:
        """Force transcription of whatever's buffered, marked as a final result.

        Call this on end-of-utterance (e.g. a VAD/turn-detector signal upstream), or before
        closing the stream, so a short trailing chunk isn't silently dropped.
        """
        async with self._lock:
            if self._buffer:
                await self._transcribe_buffered(is_final=True)

    async def events(self) -> AsyncIterator[TranscriptEvent]:
        """Async iterator of `TranscriptEvent`s, in the order they were produced."""
        while True:
            if self._closed and self._queue.empty():
                return
            try:
                event = await asyncio.wait_for(self._queue.get(), timeout=0.5)
            except asyncio.TimeoutError:
                continue
            yield event

    async def aclose(self) -> None:
        async with self._lock:
            if self._buffer:
                await self._transcribe_buffered(is_final=True)
            self._closed = True

    async def _transcribe_buffered(self, *, is_final: bool) -> None:
        audio_bytes = bytes(self._buffer)
        self._buffer.clear()
        text = await self._run_transcription(audio_bytes)
        if text:
            event = TranscriptEvent(text=text, is_final=is_final)
            await self._queue.put(event)
            logger.info("stt_transcript", text=text, is_final=is_final)

    async def _run_transcription(self, audio_bytes: bytes) -> str:
        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(self._max_attempts),
                wait=wait_exponential(multiplier=0.5, max=4),
                reraise=True,
            ):
                with attempt:
                    return await self._transcribe_once(audio_bytes)
        except TranscriptionError:
            logger.error("stt_transcription_failed", attempts=self._max_attempts)
            raise
        raise TranscriptionError("transcription failed with no attempts made")  # pragma: no cover

    async def _transcribe_once(self, audio_bytes: bytes) -> str:
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(self._transcribe_sync, audio_bytes),
                timeout=self._transcribe_timeout_seconds,
            )
        except asyncio.TimeoutError as exc:
            raise TranscriptionError(
                f"faster-whisper transcription timed out after {self._transcribe_timeout_seconds}s"
            ) from exc
        except TranscriptionError:
            raise
        except Exception as exc:
            raise TranscriptionError(f"faster-whisper transcription failed: {exc}") from exc

    def _transcribe_sync(self, audio_bytes: bytes) -> str:
        model = self._ensure_model()
        audio_array = _pcm16_bytes_to_float32(audio_bytes)
        segments, _info = model.transcribe(audio_array, language=self._language)
        text: str = " ".join(str(segment.text).strip() for segment in segments).strip()
        return text
