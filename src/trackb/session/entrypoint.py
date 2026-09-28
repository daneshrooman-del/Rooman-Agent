"""The real LiveKit Agents worker entrypoint for the intake conversation.

Launch as a worker process with:

    python -m trackb.session.entrypoint

which registers `intake_entrypoint` via `WorkerOptions(entrypoint_fnc=...)` and hands it to
`livekit.agents.cli.run_app(...)` -- the framework then owns connecting to the configured
LiveKit server, accepting job dispatches, and calling `intake_entrypoint(ctx)` once per
dispatched room.

The "drive intake to completion from transcribed utterances" logic is deliberately pulled out
into `IntakeSessionDriver` rather than inlined in `intake_entrypoint`, so it's unit-testable
against fakes (`FakeSessionWorker`-shaped objects, a fake `IntakeGraph`, a fake
`run_intake_session`) without needing a real `JobContext`/`rtc.Room` -- see
`tests/session/test_entrypoint.py`.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from typing import Protocol, runtime_checkable

import structlog
from livekit.agents import JobContext, WorkerOptions, cli

from trackb.config import Settings, get_settings
from trackb.contracts.models import AgentSpec
from trackb.intake.graph import IntakeGraph, IntakeStepResult
from trackb.intake.schema import IntakeSlots
from trackb.llm.mock import MockLLMProvider
from trackb.provisioning.interfaces import AvatarAssignment, IntakeSessionResult
from trackb.provisioning.orchestrator import run_intake_session
from trackb.session.concurrency import SessionConcurrencyGuard
from trackb.session.livekit_admin import session_id_from_room_name
from trackb.session.room_client import LiveKitRoomClient
from trackb.session.worker import SessionWorker, TranscribedUtterance
from trackb.stt.whisper_stt import WhisperSTT

logger = structlog.get_logger(__name__)

CLOSING_MESSAGE = "Thanks -- I have everything I need. I'm setting up your agent now."

_UNKNOWN_OWNER = "unknown"
"""Placeholder owner used when no participant identity is available from the job.

Track C's API layer is what will eventually mint join tokens with a real caller identity
(e.g. from an authenticated user session) baked into the LiveKit participant identity or job
metadata; until that's wired up there is genuinely no real owner to read here.
"""

_UNASSIGNED_AVATAR = AvatarAssignment(avatar_id="unassigned", voice_id="unassigned")
"""Placeholder avatar/voice assignment.

Track A's real avatar-assignment flow (matching a user's chosen look/voice to an
avatar_id/voice_id pair) doesn't exist yet -- see `AvatarAssignment`'s own docstring in
`trackb.provisioning.interfaces`. Swap this for a real assignment (e.g. built from a
`StubAvatarServiceClient.create_avatar()` call plus a chosen voice) once that flow exists.
"""


async def _placeholder_tts(text: str) -> bytes:
    """Stand-in `TextToSpeechFn` for `SessionWorker` until real TTS is wired up.

    Real TTS integration (Track A's avatar-service `generate()`, or a dedicated TTS provider)
    is a separate concern from this task. This logs what would have been spoken and returns
    empty audio so `SessionWorker.speak()` has something to publish without raising, rather
    than leaving the intake conversation unable to ask follow-up questions at all.
    """
    logger.info("tts_placeholder_speak", text=text)
    return b""


RunIntakeSessionFn = Callable[[IntakeSessionResult, AvatarAssignment], Awaitable[AgentSpec]]


@runtime_checkable
class UtteranceEmittingWorker(Protocol):
    """What `IntakeSessionDriver` needs from a `SessionWorker`-shaped object.

    Matches the slice of `SessionWorker`'s public API the driver actually calls, so tests can
    inject a lightweight fake instead of a real `SessionWorker` wired to a real `RoomClient`.
    """

    async def speak(self, text: str) -> None: ...

    async def leave(self) -> None: ...


class IntakeSessionDriver:
    """Turns transcribed utterances into intake progress, and intake completion into a
    provisioned `AgentSpec`.

    Registered as a `SessionWorker.on_utterance` handler by `intake_entrypoint`. Each final
    transcript is stepped through `IntakeGraph.step()`:

    - `"follow_up"` -> speaks `result.follow_up_question` back into the room and waits for the
      next utterance.
    - `"completed"` -> builds an `IntakeSessionResult` from the filled slots, calls
      `run_intake_session()` exactly once to provision the agent, speaks a closing message, and
      leaves the session.

    Non-final transcripts (interim STT results) and empty/whitespace-only text are ignored --
    only a final transcript represents a complete user turn worth feeding to the intake graph.
    """

    def __init__(
        self,
        *,
        session_id: str,
        owner: str,
        intake_graph: IntakeGraph,
        session_worker: UtteranceEmittingWorker,
        avatar_assignment: AvatarAssignment = _UNASSIGNED_AVATAR,
        run_intake_session_fn: RunIntakeSessionFn = run_intake_session,
    ) -> None:
        self._session_id = session_id
        self._owner = owner
        self._intake_graph = intake_graph
        self._session_worker = session_worker
        self._avatar_assignment = avatar_assignment
        self._run_intake_session_fn = run_intake_session_fn
        self._completed = False
        self._provisioned_spec: AgentSpec | None = None

    @property
    def completed(self) -> bool:
        return self._completed

    @property
    def provisioned_spec(self) -> AgentSpec | None:
        return self._provisioned_spec

    async def on_utterance(self, utterance: TranscribedUtterance) -> None:
        if not utterance.is_final or not utterance.text.strip():
            return
        if self._completed:
            return

        result: IntakeStepResult = await self._intake_graph.step(utterance.text)

        if result.status == "follow_up":
            await self._speak_follow_up(result)
            return

        await self._complete(result)

    async def _speak_follow_up(self, result: IntakeStepResult) -> None:
        assert result.follow_up_question is not None  # guaranteed by IntakeGraph on "follow_up"
        logger.info(
            "intake_follow_up_spoken",
            session_id=self._session_id,
            question=result.follow_up_question,
        )
        await self._session_worker.speak(result.follow_up_question)

    async def _complete(self, result: IntakeStepResult) -> None:
        assert result.completed_slots is not None  # guaranteed by IntakeGraph on "completed"
        slots: IntakeSlots = result.completed_slots
        intake_result = IntakeSessionResult(
            slots=slots,
            session_id=self._session_id,
            owner=self._owner,
        )

        logger.info("intake_session_completing", session_id=self._session_id, owner=self._owner)
        spec = await self._run_intake_session_fn(intake_result, self._avatar_assignment)
        self._provisioned_spec = spec
        self._completed = True

        await self._session_worker.speak(CLOSING_MESSAGE)
        await self._session_worker.leave()


def _resolve_session_id(ctx: JobContext) -> str:
    """Prefer the room name's encoded session_id over LiveKit's own job id.

    `ctx.room.name` is `room_name_for_session(session_id)` from
    `session/livekit_admin.py` -- the correlation key `POST /intake/start`
    actually handed back to the caller. `ctx.job.id` is LiveKit's internal job
    identifier, a different id space entirely; using it here would make
    `AgentSpec.created_from_session_id` untraceable back to the API session
    that started it.
    """
    room_name = getattr(ctx.room, "name", "") or ""
    session_id = session_id_from_room_name(room_name) if room_name else None
    if session_id:
        return session_id

    job_id = getattr(ctx.job, "id", "") or ""
    if job_id:
        logger.warning(
            "session_id_fallback_to_job_id",
            room_name=room_name,
            reason="room name did not match the intake room naming convention",
        )
        return job_id

    logger.warning("session_id_fallback_to_random_uuid")
    return str(uuid.uuid4())


def _resolve_owner(ctx: JobContext) -> str:
    participant = getattr(ctx.job, "participant", None)
    identity = getattr(participant, "identity", "") if participant is not None else ""
    return identity or _UNKNOWN_OWNER


async def intake_entrypoint(ctx: JobContext) -> None:
    """Framework-called entrypoint: joins the dispatched room and drives one intake
    conversation to completion (or until the session otherwise ends)."""
    settings = get_settings()
    await ctx.connect()

    session_id = _resolve_session_id(ctx)
    owner = _resolve_owner(ctx)

    room_client = LiveKitRoomClient(ctx.room)
    stt = WhisperSTT(settings=settings)
    guard = SessionConcurrencyGuard(settings=settings)
    session_worker = SessionWorker(
        session_id=session_id,
        room_client=room_client,
        stt=stt,
        guard=guard,
        settings=settings,
        tts=_placeholder_tts,
    )

    intake_graph = IntakeGraph(MockLLMProvider())
    driver = IntakeSessionDriver(
        session_id=session_id,
        owner=owner,
        intake_graph=intake_graph,
        session_worker=session_worker,
    )
    session_worker.on_utterance(driver.on_utterance)

    async def _leave_on_shutdown() -> None:
        if not driver.completed:
            await session_worker.leave()

    ctx.add_shutdown_callback(_leave_on_shutdown)

    # `LiveKitRoomClient.connect()` is a no-op that only asserts `ctx.room` is already
    # connected (see `trackb.session.room_client`); `url`/`token` are unused by it, so the
    # values passed here are placeholders to satisfy `SessionWorker.join()`'s signature.
    await session_worker.join(url=settings.livekit_url, token="")

    logger.info("session_joined", session_id=session_id, owner=owner)


def _worker_options(settings: Settings | None = None) -> WorkerOptions:
    settings = settings or get_settings()
    return WorkerOptions(
        entrypoint_fnc=intake_entrypoint,
        agent_name="trackb-intake",
        ws_url=settings.livekit_url,
        api_key=settings.livekit_api_key,
        api_secret=settings.livekit_api_secret,
    )


WORKER_OPTIONS = _worker_options()


def run_worker() -> None:
    """Start this module as a LiveKit Agents worker process."""
    cli.run_app(WORKER_OPTIONS)


if __name__ == "__main__":
    run_worker()
