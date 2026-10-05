"""The real LiveKit Agents worker entrypoint for a deployed agent's own live conversation.

Launch as a worker process with:

    python -m trackb.session.conversation_entrypoint

which registers `conversation_entrypoint` via `WorkerOptions(entrypoint_fnc=...)` and hands it
to `livekit.agents.cli.run_app(...)` -- structured exactly like `trackb.session.entrypoint`'s
`intake_entrypoint` (see that module's docstring for the framework-owned dispatch model). The
one thing intake never needed and this does: which *already-provisioned* `AgentSpec` to run.
`LiveKitAdmin.create_conversation_room` (see its docstring) passes `agent_id` through as the
dispatched job's own metadata, and `_resolve_agent_id` below reads it back via `ctx.job.metadata`.

`_build_tts_provider`/`_make_tts_fn` are imported from `trackb.session.entrypoint` rather than
duplicated -- they don't depend on anything intake-specific (just `Settings` and a
`TTSProvider`), and `entrypoint.py` doesn't import anything from this module, so there's no
circular-import risk.

As with `intake_entrypoint`, the "drive a conversation to completion from transcribed
utterances" logic is pulled out into `ConversationSessionDriver` (and the "resolve which
AgentSpec to run" logic into `_resolve_agent_spec`) so both are unit-testable against fakes
without needing a real `JobContext`/`rtc.Room` -- see
`tests/session/test_conversation_entrypoint.py`.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable

import structlog
from livekit.agents import JobContext, JobExecutorType, WorkerOptions, cli

from trackb.config import Settings, get_settings
from trackb.contracts.models import AgentSpec
from trackb.llm.factory import build_llm_provider
from trackb.provisioning.store import get_agent_spec
from trackb.session import cpu_compat
from trackb.session.concurrency import SessionConcurrencyGuard
from trackb.session.entrypoint import (
    UtteranceEmittingWorker,
    _build_stt,
    _build_tts_provider,
    _make_tts_fn,
)
from trackb.session.flow_engine import FlowGraphDriver, FlowStepResult
from trackb.session.livekit_admin import session_id_from_conversation_room_name
from trackb.session.prewarm import prewarm, warm_models
from trackb.session.room_client import LiveKitRoomClient
from trackb.session.worker import SessionWorker, TranscribedUtterance

logger = structlog.get_logger(__name__)

GetAgentSpecFn = Callable[[str], "AgentSpec | None"]


class ConversationSessionDriver:
    """Turns transcribed utterances into `FlowGraphDriver` turns for a deployed agent.

    Registered as a `SessionWorker.on_utterance` handler by `conversation_entrypoint`. Each
    final transcript is stepped through `FlowGraphDriver.step()`; its `response_text` is always
    spoken back into the room, and once a step reports `is_terminal=True` the driver leaves the
    session -- there is no separate provisioning step here (unlike `IntakeSessionDriver`): the
    `AgentSpec` this conversation runs already exists.

    Non-final transcripts (interim STT results) and empty/whitespace-only text are ignored --
    only a final transcript represents a complete user turn worth stepping the flow graph with.
    """

    def __init__(
        self,
        *,
        session_id: str,
        agent_id: str,
        flow_driver: FlowGraphDriver,
        session_worker: UtteranceEmittingWorker,
    ) -> None:
        self._session_id = session_id
        self._agent_id = agent_id
        self._flow_driver = flow_driver
        self._session_worker = session_worker
        self._completed = False

    @property
    def completed(self) -> bool:
        return self._completed

    async def on_utterance(self, utterance: TranscribedUtterance) -> None:
        if not utterance.is_final or not utterance.text.strip():
            return
        if self._completed:
            return

        result: FlowStepResult = await self._flow_driver.step(utterance.text)
        logger.info(
            "conversation_turn_spoken",
            session_id=self._session_id,
            agent_id=self._agent_id,
            state=result.current_state,
        )
        await self._session_worker.speak(result.response_text)

        if result.is_terminal:
            self._completed = True
            logger.info(
                "conversation_session_completing",
                session_id=self._session_id,
                agent_id=self._agent_id,
            )
            await self._session_worker.leave()


def _resolve_agent_id(ctx: JobContext) -> str | None:
    """Prefer the dispatched job's own metadata (set via `RoomAgentDispatch(metadata=...)` in
    `LiveKitAdmin.create_conversation_room`) over room metadata, which is only a fallback -- see
    that method's docstring for why both are set.
    """
    job_metadata = getattr(ctx.job, "metadata", "") or ""
    if job_metadata:
        return job_metadata

    room_metadata = getattr(ctx.room, "metadata", "") or ""
    if room_metadata:
        logger.warning(
            "agent_id_fallback_to_room_metadata",
            reason="job metadata was empty",
        )
        return room_metadata

    return None


def _resolve_session_id(ctx: JobContext, agent_id: str) -> str:
    """Prefer the room name's encoded session_id over LiveKit's own job id.

    Mirrors `trackb.session.entrypoint._resolve_session_id`, but conversation room names encode
    `agent_id` too (see `conversation_room_name`), so `agent_id` -- already resolved via
    `_resolve_agent_id` -- is required to unambiguously strip it back out.
    """
    room_name = getattr(ctx.room, "name", "") or ""
    session_id = (
        session_id_from_conversation_room_name(room_name, agent_id) if room_name else None
    )
    if session_id:
        return session_id

    job_id = getattr(ctx.job, "id", "") or ""
    if job_id:
        logger.warning(
            "session_id_fallback_to_job_id",
            room_name=room_name,
            reason="room name did not match the conversation room naming convention",
        )
        return job_id

    logger.warning("session_id_fallback_to_random_uuid")
    return str(uuid.uuid4())


def _resolve_agent_spec(
    agent_id: str | None, get_agent_spec_fn: GetAgentSpecFn = get_agent_spec
) -> AgentSpec | None:
    """Look up the `AgentSpec` this conversation should run, logging (rather than raising) on
    either failure mode -- a missing `agent_id` or an `agent_id` with no persisted spec --
    so `conversation_entrypoint` can disconnect cleanly instead of crashing the worker process.
    """
    if not agent_id:
        logger.error("conversation_agent_id_missing")
        return None

    spec = get_agent_spec_fn(agent_id)
    if spec is None:
        logger.error("conversation_agent_spec_not_found", agent_id=agent_id)
    return spec


async def conversation_entrypoint(ctx: JobContext) -> None:
    """Framework-called entrypoint: joins the dispatched room and drives one deployed agent's
    conversation to completion (or until the session otherwise ends)."""
    settings = get_settings()
    await ctx.connect()

    agent_id = _resolve_agent_id(ctx)
    agent_spec = _resolve_agent_spec(agent_id)
    if agent_spec is None:
        ctx.shutdown(reason="no AgentSpec available for this conversation job")
        return

    session_id = _resolve_session_id(ctx, agent_id)  # type: ignore[arg-type]  # agent_id is not None here

    room_client = LiveKitRoomClient(
        ctx.room, participant_wait_timeout_seconds=settings.participant_wait_timeout_seconds
    )
    models = warm_models(ctx)
    stt = _build_stt(settings, models)
    guard = SessionConcurrencyGuard(settings=settings)
    tts_provider = _build_tts_provider(settings, models)
    session_worker = SessionWorker(
        session_id=session_id,
        room_client=room_client,
        stt=stt,
        guard=guard,
        settings=settings,
        tts=_make_tts_fn(tts_provider, agent_spec.voice_id),
    )

    flow_driver = FlowGraphDriver(agent_spec, build_llm_provider(settings))
    driver = ConversationSessionDriver(
        session_id=session_id,
        agent_id=agent_spec.agent_id,
        flow_driver=flow_driver,
        session_worker=session_worker,
    )
    session_worker.on_utterance(driver.on_utterance)

    async def _leave_on_shutdown() -> None:
        if not driver.completed:
            await session_worker.leave()

    ctx.add_shutdown_callback(_leave_on_shutdown)

    # See `LiveKitRoomClient.connect()` / `intake_entrypoint` for why `url`/`token` are unused
    # placeholders here -- the real connection already happened via `ctx.connect()` above.
    await session_worker.join(url=settings.livekit_url, token="")

    logger.info(
        "conversation_session_joined",
        session_id=session_id,
        agent_id=agent_spec.agent_id,
    )


def _worker_options(settings: Settings | None = None) -> WorkerOptions:
    settings = settings or get_settings()
    return WorkerOptions(
        entrypoint_fnc=conversation_entrypoint,
        prewarm_fnc=prewarm,
        job_executor_type=JobExecutorType(settings.worker_job_executor),
        num_idle_processes=settings.worker_idle_processes,
        initialize_process_timeout=settings.worker_init_timeout_seconds,
        agent_name="trackb-conversation",
        ws_url=settings.livekit_url,
        api_key=settings.livekit_api_key,
        api_secret=settings.livekit_api_secret,
    )


WORKER_OPTIONS = _worker_options()


def run_worker() -> None:
    """Start this module as a LiveKit Agents worker process."""
    cpu_compat.register()
    cli.run_app(WORKER_OPTIONS)


if __name__ == "__main__":
    run_worker()
