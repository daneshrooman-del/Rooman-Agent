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

Turn/end-of-utterance detection: rather than depending on a separate VAD model (e.g.
`livekit-plugins-silero`, which pulls in torch and is too heavy for this project's memory
constraints), this wrapper uses faster-whisper's own built-in `vad_filter=True` option --
bundled with faster-whisper itself via a lightweight onnxruntime Silero VAD, no extra heavy
dependency -- to silence-filter each buffered chunk before transcribing it. An utterance is
accumulated across consecutive chunks that produce real speech; the first chunk that comes
back silent (empty text) after real speech was seen is treated as the end of that utterance
and flushes it as `is_final=True`. This is the "VAD/turn detector" referenced above, not a
placeholder for one still to be built.
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
        device: str | None = None,
        compute_type: str | None = None,
        sample_rate: int = DEFAULT_SAMPLE_RATE,
        chunk_seconds: float = 2.0,
        transcribe_timeout_seconds: float = 10.0,
        max_attempts: int = 3,
        language: str | None = None,
        vad_filter: bool = True,
    ) -> None:
        settings = settings or get_settings()
        self._model_size = settings.whisper_model_size
        self._device = device or settings.whisper_device
        self._compute_type = compute_type or settings.whisper_compute_type
        self._sample_rate = sample_rate
        self._chunk_bytes = max(1, int(chunk_seconds * sample_rate * 2))  # 2 bytes/sample (PCM16)
        self._transcribe_timeout_seconds = transcribe_timeout_seconds
        self._max_attempts = max_attempts
        self._language = language if language is not None else settings.whisper_language
        self._vad_filter = vad_filter

        self._model = model
        self._buffer = bytearray()
        self._queue: asyncio.Queue[TranscriptEvent] = asyncio.Queue()
        self._closed = False
        self._lock = asyncio.Lock()

        self._pending_utterance: list[str] = []
        """Text accumulated across consecutive speech-containing chunks, not yet finalized."""

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
                await self._process_chunk(force_final=False)

    async def flush(self) -> None:
        """Force whatever's buffered to be transcribed and the current utterance finalized.

        Call this on an explicit end-of-utterance signal, or before closing the stream, so a
        short trailing chunk isn't silently dropped. In normal operation this isn't needed --
        `_process_chunk` already finalizes on its own once silence follows speech -- but it's
        here for a caller that has its own (e.g. external) end-of-turn signal.
        """
        async with self._lock:
            await self._process_chunk(force_final=True)

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
            await self._process_chunk(force_final=True)
            self._closed = True

    async def _process_chunk(self, *, force_final: bool) -> None:
        """Transcribe whatever's currently buffered (if any) and drive the
        accumulate-until-silence turn-detection state machine:

        - Real speech in this chunk -> appended to the in-progress utterance. Reported as an
          interim (`is_final=False`) update unless `force_final` says to finalize right away
          (an explicit `flush()`/`aclose()`, not the normal per-chunk path).
        - No speech in this chunk (faster-whisper's own `vad_filter` returned nothing) -> the
          in-progress utterance, if any, just ended; finalize it. This is what lets a plain
          silence-after-speech pattern in the raw audio act as the turn detector, without a
          separate VAD model.
        """
        audio_bytes = bytes(self._buffer)
        self._buffer.clear()
        text = await self._run_transcription(audio_bytes) if audio_bytes else ""

        if text:
            self._pending_utterance.append(text)

        if text and not force_final:
            combined = " ".join(self._pending_utterance)
            event = TranscriptEvent(text=combined, is_final=False)
            await self._queue.put(event)
            logger.info("stt_transcript", text=combined, is_final=False)
        else:
            await self._finalize_pending()

    async def _finalize_pending(self) -> None:
        if not self._pending_utterance:
            return
        combined = " ".join(self._pending_utterance)
        self._pending_utterance.clear()
        event = TranscriptEvent(text=combined, is_final=True)
        await self._queue.put(event)
        logger.info("stt_transcript", text=combined, is_final=True)

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
        segments, _info = model.transcribe(
            audio_array, language=self._language, vad_filter=self._vad_filter
        )
        text: str = " ".join(str(segment.text).strip() for segment in segments).strip()
        return text
