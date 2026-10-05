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
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

import structlog

from trackb.config import Settings, get_settings
from trackb.session.concurrency import SessionConcurrencyGuard
from trackb.session.room_client import RoomClient
from trackb.streaming import sentence_chunks
from trackb.stt.whisper_stt import TranscriptEvent

logger = structlog.get_logger(__name__)

_SPEAK_PIPELINE_DEPTH = 2

TURN_FAILED_MESSAGE = "Sorry, I had trouble with that. Could you say it again?"


async def _single(text: str) -> AsyncIterator[str]:
    yield text


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
        self._leaving = False

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
        self._audio_pump_task.add_done_callback(self._on_pump_task_done)
        self._transcript_pump_task.add_done_callback(self._on_pump_task_done)

        register_text_handler = getattr(self._room_client, "on_text_message", None)
        if register_text_handler is not None:
            register_text_handler(self._handle_typed_text)

    async def _handle_typed_text(self, text: str) -> None:
        """Feed a typed message (from the frontend's text composer, over the room's text-chat
        channel) into the same conversation pipeline as a spoken, transcribed utterance --
        `IntakeSessionDriver`/`ConversationSessionDriver` need no changes, they already just
        react to `TranscribedUtterance`s regardless of where one came from.

        Not echoed back as a transcription: the frontend already appends the user's own typed
        text to its transcript optimistically, before this even reaches the backend -- doing
        it here too would duplicate the line."""
        utterance = TranscribedUtterance(
            session_id=self._session_id, text=text, is_final=True
        )
        await self._dispatch(utterance)

    async def _dispatch(self, utterance: TranscribedUtterance) -> None:
        """Run the registered handler for one utterance, keeping the session alive if it fails.

        A turn handler error (LLM timeout or 429, a bad structured reply, a TTS failure) used to
        escape: for spoken input it killed the transcript pump and so the whole session, and for
        typed input it vanished as an un-retrieved task exception with no reply. Now it's logged
        with its traceback and the caller hears a short apology, so they know to try again.
        """
        handler = self._on_utterance
        if handler is None:
            return
        try:
            await handler(utterance)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("session_turn_failed", session_id=self._session_id)
            if self._tts is None:
                return
            try:
                await self.speak(TURN_FAILED_MESSAGE)
            except Exception:
                logger.exception("session_turn_failed_apology_failed", session_id=self._session_id)

    def _on_pump_task_done(self, task: asyncio.Task[None]) -> None:
        """A pump task normally only ends via `leave()` cancelling it. If one instead ends on
        its own with a real exception (e.g. `audio_frames()` timing out waiting for a
        participant who never joins), the session is no longer functional -- half its audio
        pipeline is dead -- so force a full `leave()` rather than let it sit as a silent
        zombie: still "joined", never speaking again, its other pump task running forever
        against a channel that will never produce anything.
        """
        if task.cancelled() or task.exception() is None or self._leaving:
            return
        logger.error(
            "session_pump_task_died_forcing_leave",
            session_id=self._session_id,
            error=str(task.exception()),
        )
        asyncio.create_task(self.leave())

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
                utterance = TranscribedUtterance(
                    session_id=self._session_id,
                    text=event.text,
                    is_final=event.is_final,
                )
                await self._dispatch(utterance)
                await self._publish_caller_transcription(utterance)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error(
                "session_transcript_pump_failed", session_id=self._session_id, error=str(exc)
            )
            raise

    async def _publish_caller_transcription(self, utterance: TranscribedUtterance) -> None:
        """Publish the human caller's utterance (interim or final) as a room transcription,
        addressed to the remote participant/track `LiveKitRoomClient.audio_frames()` already
        discovered. Skipped (with a log line) rather than raised if that identity/track isn't
        known yet -- e.g. a race where STT somehow produces an event before the audio pump has
        found a remote participant."""
        identity = getattr(self._room_client, "remote_identity", None)
        track_sid = getattr(self._room_client, "remote_track_sid", None)
        if not identity or not track_sid:
            logger.debug(
                "caller_transcription_publish_skipped_no_remote_track",
                session_id=self._session_id,
            )
            return
        await self._publish_transcription_safe(
            participant_identity=identity,
            track_sid=track_sid,
            text=utterance.text,
            final=utterance.is_final,
        )

    async def _publish_agent_transcription(
        self, text: str, *, segment_id: str | None = None, final: bool = True
    ) -> None:
        """Publish the agent's own spoken line as a room transcription, addressed to the local
        participant/track. `final=True` unless `speak_stream` is still growing the reply's
        segment sentence by sentence (same `segment_id`, interim until the reply ends).
        Skipped (with a log line), not raised, if the local track isn't published yet
        (shouldn't happen in practice: audio is always published before its transcript)."""
        identity = getattr(self._room_client, "local_identity", None)
        track_sid = getattr(self._room_client, "local_track_sid", None)
        if not identity or not track_sid:
            logger.debug(
                "agent_transcription_publish_skipped_no_local_track",
                session_id=self._session_id,
            )
            return
        await self._publish_transcription_safe(
            participant_identity=identity,
            track_sid=track_sid,
            text=text,
            final=final,
            segment_id=segment_id,
        )

    async def _publish_transcription_safe(
        self,
        *,
        participant_identity: str,
        track_sid: str,
        text: str,
        final: bool,
        segment_id: str | None = None,
    ) -> None:
        """Publish one transcription segment, catching and logging any failure rather than
        letting it propagate -- losing a transcript line is much less bad than losing the whole
        conversation over it. `RoomClient.publish_transcription()` already retries transient
        failures itself (see `room_client.py`); this only guards against it exhausting that
        budget, or against a `RoomClient` implementation that doesn't support it at all."""
        try:
            await self._room_client.publish_transcription(
                participant_identity=participant_identity,
                track_sid=track_sid,
                segment_id=segment_id or str(uuid.uuid4()),
                text=text,
                final=final,
            )
        except Exception as exc:
            logger.error(
                "session_transcription_publish_failed",
                session_id=self._session_id,
                participant_identity=participant_identity,
                error=str(exc),
            )

    async def speak(self, text: str) -> None:
        """Synthesize `text` (via the injected `tts` function) and publish it to the room.

        Split into sentences and sent through `speak_stream`, so the first sentence starts
        playing while the rest are still being synthesized."""
        await self.speak_stream(sentence_chunks(_single(text)))

    async def speak_stream(self, sentences: AsyncIterator[str]) -> None:
        """Speak a stream of sentences (e.g. `sentence_chunks(llm.stream(...))`) with
        synthesis pipelined ahead of publishing.

        A producer task synthesizes sentence N+1 while sentence N is being published, buffered
        at most `_SPEAK_PIPELINE_DEPTH` clips ahead so a slow room can't make it run away.
        The reply is one transcript segment that grows as each sentence's audio is published
        (interim), then is marked final -- so the transcript shows one line per reply and only
        ever contains what was actually spoken. If this call is cancelled (e.g. on barge-in) or
        publishing fails, the producer is cancelled too and the source stream is closed.
        """
        if self._tts is None:
            raise NotImplementedError(
                "SessionWorker was constructed without a `tts` function -- pass one, or call "
                "`say_audio()` directly with already-synthesized audio."
            )
        tts = self._tts
        queue: asyncio.Queue[tuple[str, bytes] | BaseException | None] = asyncio.Queue(
            maxsize=_SPEAK_PIPELINE_DEPTH
        )

        async def _produce() -> None:
            try:
                async for sentence in sentences:
                    await queue.put((sentence, await tts(sentence)))
                await queue.put(None)
            except asyncio.CancelledError:
                raise
            except BaseException as exc:
                await queue.put(exc)

        producer = asyncio.create_task(_produce())
        segment_id = str(uuid.uuid4())
        spoken: list[str] = []
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                if isinstance(item, BaseException):
                    raise item
                sentence, audio = item
                await self._room_client.publish_audio(audio)
                spoken.append(sentence)
                await self._publish_agent_transcription(
                    " ".join(spoken), segment_id=segment_id, final=False
                )
            if spoken:
                await self._publish_agent_transcription(
                    " ".join(spoken), segment_id=segment_id, final=True
                )
        finally:
            producer.cancel()
            try:
                await producer
            except asyncio.CancelledError:
                pass
            aclose = getattr(sentences, "aclose", None)
            if aclose is not None:
                await aclose()

    async def say_audio(self, audio: bytes, *, text: str | None = None) -> None:
        """Publish already-synthesized audio to the room.

        `text` is optional and purely for transcription purposes: when provided (as `speak()`
        always does), it's published as the agent's own transcription segment alongside the
        audio -- see `_publish_agent_transcription`. Callers with no associated text (e.g.
        Track A's `AvatarServiceClient.generate()` output) can omit it and just publish audio,
        exactly as before.
        """
        await self._room_client.publish_audio(audio)
        if text is not None:
            await self._publish_agent_transcription(text)

    async def leave(self) -> None:
        """Stop pumping, flush any buffered audio through STT, and disconnect.

        Idempotent and safe to call more than once -- e.g. once from a caller's own shutdown
        path, once from `_on_pump_task_done`'s forced cleanup -- a second call is a no-op.
        """
        if self._leaving:
            return
        self._leaving = True
        for task in (self._audio_pump_task, self._transcript_pump_task):
            if task is not None and not task.done():
                task.cancel()
        for task in (self._audio_pump_task, self._transcript_pump_task):
            if task is not None:
                try:
                    await task
                except asyncio.CancelledError:
                    pass
                except Exception as exc:
                    logger.debug(
                        "session_pump_task_raised_during_leave",
                        session_id=self._session_id,
                        error=str(exc),
                    )
        await self._stt.aclose()
        if self._joined:
            await self._room_client.disconnect()
            logger.info("session_end", session_id=self._session_id)
        self._joined = False
