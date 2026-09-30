"""Assembles and persists the final `AgentSpec`.

`run_intake_session` is Track B's half of the `run_intake_session() -> AgentSpec`
entry point from the cross-track contract. It does NOT drive the intake
conversation itself -- that's `trackb.intake.graph.IntakeGraph.step()`, called
turn by turn by whoever owns the live session (the LiveKit session loop, or
Track C's API layer for a text-only path) as utterances arrive. Once that
caller sees `IntakeStepResult.status == "completed"`, it builds an
`IntakeSessionResult` (slots + its own session_id/owner bookkeeping) and calls
this function to turn that into a persisted `AgentSpec`.

`flow_graph_generator` and `kb_ingestor` default to the real
`trackb.flowgen.generate_flow_graph` / `trackb.kb.ingest` (both exist now);
they stay overridable so tests can inject fakes without a real LLM or Qdrant.
"""

from __future__ import annotations

import uuid
from typing import Literal

import structlog
from sqlalchemy.engine import Engine

from trackb.contracts.models import AgentSpec, ToolBinding
from trackb.flowgen import generate_flow_graph as _default_flow_graph_generator
from trackb.intake.schema import IntakeSlots
from trackb.kb import ingest as _default_kb_ingestor
from trackb.llm.base import LLMProvider
from trackb.llm.mock import MockLLMProvider
from trackb.provisioning.interfaces import (
    AvatarAssignment,
    FlowGraphGenerator,
    IntakeSessionResult,
    KnowledgeBaseIngestor,
)
from trackb.provisioning.store import save_agent_spec

log = structlog.get_logger(__name__)

DEFAULT_GUARDRAILS: tuple[str, ...] = (
    "Never provide medical, legal, or financial advice beyond the agent's stated purpose.",
    "Escalate to a human when the caller explicitly asks for one.",
)


class IncompleteIntakeError(Exception):
    """Raised when an intake session ended without filling all required slots.

    Assembling an `AgentSpec` from incomplete slots would silently produce a
    broken agent (e.g. no purpose, no workflow), so this is raised instead of
    falling back to empty defaults.
    """

    def __init__(self, missing_slots: list[str]) -> None:
        self.missing_slots = missing_slots
        super().__init__(f"intake session ended with missing required slots: {missing_slots}")


async def run_intake_session(
    intake_result: IntakeSessionResult,
    avatar_assignment: AvatarAssignment,
    *,
    flow_graph_generator: FlowGraphGenerator | None = None,
    llm: LLMProvider | None = None,
    kb_ingestor: KnowledgeBaseIngestor | None = None,
    tool_bindings: list[ToolBinding] | None = None,
    guardrails: list[str] | None = None,
    channels: list[Literal["phone", "web", "api"]] | None = None,
    persist: bool = True,
    engine: Engine | None = None,
) -> AgentSpec:
    """Generate a flow graph, ingest any reference documents, assemble a
    complete `AgentSpec` from an already-finished intake conversation, and
    persist it.

    Args:
        intake_result: the completed output of driving `IntakeGraph.step()`
            to completion -- provisioning never drives that conversation
            itself, only finalizes it.
        avatar_assignment: the avatar_id/voice_id to wire into the spec.
        flow_graph_generator: turns filled slots into a `FlowGraph`; defaults
            to the real `trackb.flowgen.generate_flow_graph`.
        llm: passed through to `flow_graph_generator`; defaults to
            `MockLLMProvider` for local/dev use since the real backend is
            chosen outside this track and wired in via config.
        kb_ingestor: ingests `intake_result.reference_documents` into a
            knowledge base if any were provided; defaults to the real
            `trackb.kb.ingest`.
        tool_bindings, guardrails, channels: optional overrides; sensible
            defaults are used otherwise.
        persist: set False in tests that don't want a DB write.
        engine: explicit sqlmodel engine to persist to; defaults to the
            process-wide engine for `Settings.database_url`. Mainly for tests
            that want an isolated database.

    Raises:
        IncompleteIntakeError: if the intake session ended without filling
            every slot in `IntakeSlots.missing_required_slots()`.
    """
    log.info("session_start", session_id=intake_result.session_id)

    flow_graph_generator = flow_graph_generator or _default_flow_graph_generator
    kb_ingestor = kb_ingestor or _default_kb_ingestor

    missing_slots = intake_result.slots.missing_required_slots()
    if missing_slots:
        log.error(
            "intake_incomplete",
            session_id=intake_result.session_id,
            missing_slots=missing_slots,
        )
        raise IncompleteIntakeError(missing_slots)

    log.info(
        "slot_filled",
        session_id=intake_result.session_id,
        filled_slots=list(intake_result.slots.model_dump(exclude_none=True)),
    )

    effective_llm = llm or MockLLMProvider()
    flow_graph = await flow_graph_generator(intake_result.slots, effective_llm)
    log.info(
        "flow_generated",
        session_id=intake_result.session_id,
        entry_state=flow_graph.entry_state,
        state_count=len(flow_graph.states),
    )

    agent_id = str(uuid.uuid4())

    knowledge_base_id: str | None = None
    if kb_ingestor is not None and intake_result.reference_documents:
        knowledge_base_id = await kb_ingestor(agent_id, intake_result.reference_documents)

    spec = AgentSpec(
        agent_id=agent_id,
        owner=intake_result.owner,
        purpose=intake_result.slots.purpose or "",
        persona_prompt=_build_persona_prompt(intake_result.slots),
        flow_graph=flow_graph,
        knowledge_base_id=knowledge_base_id,
        tool_bindings=tool_bindings or [],
        guardrails=guardrails or list(DEFAULT_GUARDRAILS),
        avatar_id=avatar_assignment.avatar_id,
        voice_id=avatar_assignment.voice_id,
        languages=intake_result.slots.languages or ["en"],
        channels=channels or ["web"],
        status="draft",
        created_from_session_id=intake_result.session_id,
    )

    if persist:
        save_agent_spec(spec, engine=engine)

    log.info("agent_provisioned", agent_id=spec.agent_id, session_id=intake_result.session_id)
    log.info("session_end", session_id=intake_result.session_id)

    return spec


def _build_persona_prompt(slots: IntakeSlots) -> str:
    tone = slots.tone or "professional and helpful"
    persona = slots.caller_persona or "the caller"
    if slots.workflow_steps:
        steps = ", ".join(slots.workflow_steps)
    else:
        steps = "the requested workflow"
    return (
        f"You are a {tone} voice/video agent. Your purpose: {slots.purpose}. "
        f"You interact with {persona}. Drive every conversation through these steps, "
        f"in order: {steps}."
    )
