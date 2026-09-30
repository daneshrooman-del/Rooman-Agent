"""Registers `WhisperSTT` as a real `livekit.agents.stt.STT` plugin.

Written once `livekit-agents` (1.8.3 at write time) was confirmed installed and importable,
against its actual `stt.STT` base class rather than a guessed shape. `STT` only requires one
abstract method, `_recognize_impl(buffer, *, language, conn_options) -> SpeechEvent` -- a
batch call taking one already-assembled utterance and returning one transcript. Declaring
`STTCapabilities(streaming=False, ...)` means livekit-agents' own VAD-driven `StreamAdapter`
wraps this to produce a full streaming interface automatically (segmenting turns and calling
`_recognize_impl` once per turn); this class does not need to implement `RecognizeStream`
itself. Register a VAD alongside it in the agent session (e.g. `livekit.plugins.silero`) for
that to work -- this module has no opinion on which one.

The buffering/retry/timeout logic lives in `WhisperSTT` (`trackb.stt.whisper_stt`); this is a
thin adapter that hands `_recognize_impl` one utterance at a time to
`WhisperSTT.transcribe_utterance`.
"""

from __future__ import annotations

from livekit import rtc
from livekit.agents.language import LanguageCode
from livekit.agents.stt import STT, SpeechData, SpeechEvent, SpeechEventType, STTCapabilities
from livekit.agents.types import (
    DEFAULT_API_CONNECT_OPTIONS,
    NOT_GIVEN,
    APIConnectOptions,
    NotGivenOr,
)
from livekit.agents.utils import is_given
from livekit.agents.utils.audio import combine_frames
from typing_extensions import Never

from trackb.config import Settings
from trackb.stt.whisper_stt import WhisperSTT

# What livekit-agents' `stt.STT._recognize_impl` actually receives: one already-assembled
# utterance, as a single frame or the list of frames that make it up. Re-declared locally
# rather than imported since `livekit.agents.stt.stt.AudioBuffer` isn't part of that module's
# public `__all__`.
AudioBuffer = list[rtc.AudioFrame] | rtc.AudioFrame

_DEFAULT_LANGUAGE = "en"


class WhisperLiveKitSTT(STT[Never]):
    """Batch (non-streaming) LiveKit STT plugin backed by `WhisperSTT`/faster-whisper."""

    def __init__(
        self,
        *,
        settings: Settings | None = None,
        whisper: WhisperSTT | None = None,
        default_language: str = _DEFAULT_LANGUAGE,
    ) -> None:
        super().__init__(
            capabilities=STTCapabilities(
                streaming=False, interim_results=False, offline_recognize=True
            )
        )
        self._whisper = whisper or WhisperSTT(settings=settings)
        self._default_language = default_language

    @property
    def model(self) -> str:
        return f"faster-whisper-{self._whisper.model_size}"

    @property
    def provider(self) -> str:
        return "trackb-whisper"

    async def _recognize_impl(
        self,
        buffer: AudioBuffer,
        *,
        language: NotGivenOr[str] = NOT_GIVEN,
        conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS,
    ) -> SpeechEvent:
        frame = combine_frames(buffer)
        audio_bytes = bytes(frame.data.cast("b"))
        text = await self._whisper.transcribe_utterance(audio_bytes)
        resolved_language = language if is_given(language) else self._default_language
        return SpeechEvent(
            type=SpeechEventType.FINAL_TRANSCRIPT,
            alternatives=[SpeechData(language=LanguageCode(resolved_language), text=text)],
        )
