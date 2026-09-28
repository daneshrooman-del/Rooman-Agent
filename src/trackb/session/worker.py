"""The LiveKit Agents worker entrypoint: joins a room for one live conversation and wires
audio through `WhisperSTT`.

`SessionWorker` depends only on the small `RoomClient` protocol in
`trackb.session.room_client`, not the real `livekit-agents` SDK directly -- see that module's
docstring for why (the real worker model is a framework-called `entrypoint(ctx: JobContext)`,
not an on-demand `connect(url, token)`, and reconciling the two touches how Track C dispatches
a job per session). Once that's decided, the real entrypoint constructs a `LiveKitRoomClient`
(adapting `JobContext`/`rtc.Room` to `RoomClient`) and a `WhisperSTT`, and drives them through
a `SessionWorker` exactly as here -- none of the concurrency-guard or pump logic below should
need to change.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

import structlog

from trackb.config import Settings, get_settings
from trackb.session.concurrency import SessionConcurrencyGuard
from trackb.session.room_client import RoomClient
from trackb.stt.whisper_stt import TranscriptEvent

logger = structlog.get_logger(__name__)


@runtime_checkable
class SpeechToText(Protocol):
    """What `SessionWorker` needs from an STT implementation.

    `WhisperSTT` (`trackb.stt.whisper_stt`) satisfies this; tests can inject a lightweight
    fake instead, without needing a real faster-whisper model.
    """

    async def push_audio(self, chunk: bytes) -> None: ...

    def events(self) -> AsyncIterator[TranscriptEvent]: ...

    async def aclose(self) -> None: ...


@dataclass(frozen=True)
class TranscribedUtterance:
    session_id: str
    text: str
    is_final: bool


UtteranceHandler = Callable[[TranscribedUtterance], Awaitable[None]]
TextToSpeechFn = Callable[[str], Awaitable[bytes]]


class SessionWorker:
    """Joins a LiveKit room for one live conversation and wires audio both ways.

    Downstream logic (the intake graph during onboarding, or a deployed agent's conversation
    loop later) never talks to LiveKit or Whisper directly: it registers a handler via
    `on_utterance()` to consume transcribed text as it arrives, and calls `speak()` /
    `say_audio()` to respond -- keeping that logic fully decoupled from the transport and STT
    implementation.
    """

    def __init__(
        self,
        *,
        session_id: str,
        room_client: RoomClient,
        stt: SpeechToText,
        guard: SessionConcurrencyGuard | None = None,
        settings: Settings | None = None,
        tts: TextToSpeechFn | None = None,
    ) -> None:
        self._session_id = session_id
        self._room_client = room_client
        self._stt = stt
        self._guard = guard or SessionConcurrencyGuard(settings=settings or get_settings())
        self._tts = tts

        self._on_utterance: UtteranceHandler | None = None
        self._audio_pump_task: asyncio.Task[None] | None = None
        self._transcript_pump_task: asyncio.Task[None] | None = None
        self._joined = False

    @property
    def session_id(self) -> str:
        return self._session_id

    def on_utterance(self, handler: UtteranceHandler) -> None:
        """Register the callback invoked for each `TranscribedUtterance` produced from STT."""
        self._on_utterance = handler

    async def join(self, *, url: str, token: str) -> None:
        """Join the room under the concurrency + timeout guard, then start pumping audio.

        Raises `SessionCapacityError` / `SessionJoinTimeoutError` (see
        `trackb.session.concurrency`) instead of hanging or piling up under load.
        """

        async def _do_join() -> None:
            await self._room_client.connect(url=url, token=token)

        await self._guard.run(_do_join, session_id=self._session_id)
        self._joined = True
        logger.info("session_start", session_id=self._session_id)

        self._audio_pump_task = asyncio.create_task(self._pump_audio_in())
        self._transcript_pump_task = asyncio.create_task(self._pump_transcripts_out())

    async def _pump_audio_in(self) -> None:
        try:
            async for frame in self._room_client.audio_frames():
                await self._stt.push_audio(frame)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("session_audio_pump_failed", session_id=self._session_id, error=str(exc))
            raise

    async def _pump_transcripts_out(self) -> None:
        try:
            async for event in self._stt.events():
                handler = self._on_utterance
                if handler is not None:
                    await handler(
                        TranscribedUtterance(
                            session_id=self._session_id,
                            text=event.text,
                            is_final=event.is_final,
                        )
                    )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error(
                "session_transcript_pump_failed", session_id=self._session_id, error=str(exc)
            )
            raise

    async def speak(self, text: str) -> None:
        """Synthesize `text` (via the injected `tts` function) and publish it to the room."""
        if self._tts is None:
            raise NotImplementedError(
                "SessionWorker was constructed without a `tts` function -- pass one, or call "
                "`say_audio()` directly with already-synthesized audio (e.g. from Track A's "
                "AvatarServiceClient.generate())."
            )
        audio = await self._tts(text)
        await self.say_audio(audio)

    async def say_audio(self, audio: bytes) -> None:
        """Publish already-synthesized audio to the room."""
        await self._room_client.publish_audio(audio)

    async def leave(self) -> None:
        """Stop pumping, flush any buffered audio through STT, and disconnect."""
        for task in (self._audio_pump_task, self._transcript_pump_task):
            if task is not None:
                task.cancel()
        for task in (self._audio_pump_task, self._transcript_pump_task):
            if task is not None:
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        await self._stt.aclose()
        if self._joined:
            await self._room_client.disconnect()
            logger.info("session_end", session_id=self._session_id)
        self._joined = False
