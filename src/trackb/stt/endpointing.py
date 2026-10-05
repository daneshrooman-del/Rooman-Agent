"""VAD-endpointed speech-to-text: detect end of speech in ~32 ms steps, then transcribe once.

`WhisperSTT`'s built-in turn detection buffers fixed 2 s chunks and ends a turn only when a whole
chunk comes back silent, so every turn waits 2-4 s after the user stops talking, and chunk edges
cut words in half ("I want to- build"). This module instead runs Silero VAD on 32 ms windows as
audio arrives, ends the utterance after `min_silence_ms` of silence, and transcribes the complete
utterance in one Whisper call.

- `SileroStreamingVAD` -- the Silero ONNX model bundled with faster-whisper, but with its LSTM
  state carried across calls. faster-whisper's own wrapper resets state on every call because it
  only ever scores whole files.
- `Endpointer` -- pure state machine over speech probabilities: no model, no I/O, unit-testable.
- `EndpointedSTT` -- satisfies `trackb.session.worker.SpeechToText`; a drop-in for `WhisperSTT`.
"""

from __future__ import annotations

import asyncio
import contextlib
from collections import deque
from collections.abc import AsyncIterator, Callable
from typing import Any, Protocol

import numpy as np
import numpy.typing as npt
import structlog

from trackb.stt.whisper_stt import DEFAULT_SAMPLE_RATE, TranscriptEvent

logger = structlog.get_logger(__name__)

WINDOW_SAMPLES = 512
"""Silero's native window at 16 kHz (32 ms)."""
_CONTEXT_SAMPLES = 64
_BYTES_PER_SAMPLE = 2

SpeechProbFn = Callable[[npt.NDArray[np.float32]], float]


class SileroStreamingVAD:
    """Scores one 512-sample float32 window at a time, keeping LSTM state between calls."""

    def __init__(self, session: Any | None = None) -> None:
        self._session = session
        self.reset()

    def reset(self) -> None:
        self._h = np.zeros((1, 1, 128), dtype=np.float32)
        self._c = np.zeros((1, 1, 128), dtype=np.float32)
        self._context = np.zeros(_CONTEXT_SAMPLES, dtype=np.float32)

    def _ensure_session(self) -> Any:
        if self._session is None:
            from faster_whisper.vad import get_vad_model

            self._session = get_vad_model().session
        return self._session

    def __call__(self, window: npt.NDArray[np.float32]) -> float:
        session = self._ensure_session()
        x = np.concatenate([self._context, window]).reshape(1, -1).astype(np.float32)
        out, self._h, self._c = session.run(None, {"input": x, "h": self._h, "c": self._c})
        self._context = window[-_CONTEXT_SAMPLES:]
        return float(np.asarray(out).reshape(-1)[0])


class Endpointer:
    """Turns a stream of PCM16 audio into complete utterances using per-window speech scores.

    - Speech starts after `min_speech_ms` of consecutive windows scoring >= `threshold`.
      `pre_roll_ms` of audio from before that point is kept so the first syllable isn't lost.
    - Speech ends after `min_silence_ms` of consecutive windows scoring < `neg_threshold`
      (hysteresis: scores between the two thresholds neither start nor end speech).
    - An utterance longer than `max_utterance_s` is cut there, so a noisy room can't buffer
      forever.
    """

    def __init__(
        self,
        speech_prob: SpeechProbFn,
        *,
        sample_rate: int = DEFAULT_SAMPLE_RATE,
        threshold: float = 0.5,
        neg_threshold: float = 0.35,
        min_speech_ms: int = 160,
        min_silence_ms: int = 500,
        pre_roll_ms: int = 300,
        max_utterance_s: float = 30.0,
    ) -> None:
        if sample_rate != DEFAULT_SAMPLE_RATE:
            raise ValueError("Silero windows are defined for 16 kHz audio")
        self._prob = speech_prob
        self._threshold = threshold
        self._neg_threshold = neg_threshold
        window_ms = WINDOW_SAMPLES * 1000 / sample_rate
        self._min_speech_windows = max(1, round(min_speech_ms / window_ms))
        self._min_silence_windows = max(1, round(min_silence_ms / window_ms))
        self._max_windows = max(1, int(max_utterance_s * 1000 / window_ms))
        self._pre_roll: deque[bytes] = deque(maxlen=max(1, round(pre_roll_ms / window_ms)))

        self._pending = bytearray()  # audio not yet a whole window
        self._in_speech = False
        self._speech_run = 0
        self._silence_run = 0
        self._utterance: list[bytes] = []

    @property
    def in_speech(self) -> bool:
        return self._in_speech

    def feed(self, pcm16: bytes) -> list[bytes]:
        """Consume audio; return any utterances (PCM16 bytes) that completed in it."""
        self._pending.extend(pcm16)
        window_bytes = WINDOW_SAMPLES * _BYTES_PER_SAMPLE
        done: list[bytes] = []
        while len(self._pending) >= window_bytes:
            window = bytes(self._pending[:window_bytes])
            del self._pending[:window_bytes]
            finished = self._step(window)
            if finished is not None:
                done.append(finished)
        return done

    def flush(self) -> bytes | None:
        """End any in-progress utterance now (e.g. on close)."""
        if not self._in_speech:
            return None
        return self._finish()

    def _step(self, window: bytes) -> bytes | None:
        samples = np.frombuffer(window, dtype=np.int16).astype(np.float32) / 32768.0
        prob = self._prob(samples)

        if not self._in_speech:
            self._pre_roll.append(window)
            self._speech_run = self._speech_run + 1 if prob >= self._threshold else 0
            if self._speech_run >= self._min_speech_windows:
                self._in_speech = True
                self._silence_run = 0
                self._utterance = list(self._pre_roll)
                self._pre_roll.clear()
            return None

        self._utterance.append(window)
        if prob < self._neg_threshold:
            self._silence_run += 1
        elif prob >= self._threshold:
            self._silence_run = 0
        ended = self._silence_run >= self._min_silence_windows
        if ended or len(self._utterance) >= self._max_windows:
            return self._finish()
        return None

    def _finish(self) -> bytes:
        audio = b"".join(self._utterance)
        self._utterance = []
        self._in_speech = False
        self._speech_run = 0
        self._silence_run = 0
        return audio


class UtteranceTranscriber(Protocol):
    async def transcribe_utterance(self, audio_bytes: bytes) -> str: ...


class EndpointedSTT:
    """`SpeechToText` that endpoints with `Endpointer` and transcribes whole utterances.

    `push_audio` only runs the (sub-millisecond) VAD inline; transcription happens on a
    background task, in order, so a slow Whisper call never stalls the incoming audio pump.
    Only final events are produced -- the drivers ignore interims, and skipping them saves the
    CPU that re-transcribing a growing buffer would cost.
    """

    def __init__(self, transcriber: UtteranceTranscriber, endpointer: Endpointer) -> None:
        self._transcriber = transcriber
        self._endpointer = endpointer
        self._utterances: asyncio.Queue[bytes | None] = asyncio.Queue()
        self._events: asyncio.Queue[TranscriptEvent | None] = asyncio.Queue()
        self._worker: asyncio.Task[None] | None = None
        self._closed = False

    async def push_audio(self, chunk: bytes) -> None:
        if self._closed:
            raise RuntimeError("EndpointedSTT is closed; cannot push more audio")
        self._ensure_worker()
        for utterance in self._endpointer.feed(chunk):
            logger.info("stt_endpoint", utterance_seconds=round(len(utterance) / 32000, 2))
            await self._utterances.put(utterance)

    async def events(self) -> AsyncIterator[TranscriptEvent]:
        while True:
            event = await self._events.get()
            if event is None:
                return
            yield event

    async def aclose(self) -> None:
        if self._closed:
            return
        self._closed = True
        self._ensure_worker()
        tail = self._endpointer.flush()
        if tail:
            await self._utterances.put(tail)
        await self._utterances.put(None)
        if self._worker is not None:
            with contextlib.suppress(Exception):
                await self._worker
        await self._events.put(None)

    def _ensure_worker(self) -> None:
        if self._worker is None:
            self._worker = asyncio.create_task(self._transcribe_loop())

    async def _transcribe_loop(self) -> None:
        while True:
            utterance = await self._utterances.get()
            if utterance is None:
                return
            try:
                text = (await self._transcriber.transcribe_utterance(utterance)).strip()
            except Exception as exc:  # one bad utterance shouldn't kill the session
                logger.error("stt_utterance_failed", error=str(exc))
                continue
            if text:
                logger.info("stt_transcript", text=text, is_final=True)
                await self._events.put(TranscriptEvent(text=text, is_final=True))


def build_endpointed_stt(
    transcriber: UtteranceTranscriber, *, min_silence_ms: int, vad_session: Any | None = None
) -> EndpointedSTT:
    return EndpointedSTT(
        transcriber,
        Endpointer(SileroStreamingVAD(session=vad_session), min_silence_ms=min_silence_ms),
    )
