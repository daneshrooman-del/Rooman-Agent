"""Assembles and persists the final `AgentSpec`.

`run_intake_session` is Track B's half of the `run_intake_session() -> AgentSpec`
entry point from the cross-track contract. The literal contract signature takes
no arguments because, conceptually, Track C just wants "run an intake session,
get back a spec" -- but the actual driver (`IntakeGraph`), flow-graph generator,
and KB ingestor are being built by other agents in parallel and don't exist as
importable code yet. So this function takes them as injected, Protocol-shaped
dependencies (see `provisioning/interfaces.py`) instead of importing concrete
modules. Once those land, a zero-arg wrapper (or a config-driven factory) that
supplies the real objects as defaults can sit in front of this and satisfy the
contract signature exactly; until then, callers (the API layer, tests) pass
the dependencies explicitly.
"""

from __future__ import annotations

import uuid
from typing import Literal

import structlog
from sqlalchemy.engine import Engine

from trackb.contracts.models import AgentSpec, ToolBinding
from trackb.intake.schema import IntakeSlots
from trackb.llm.base import LLMProvider
from trackb.llm.mock import MockLLMProvider
from trackb.provisioning.interfaces import (
    AvatarAssignment,
    FlowGraphGenerator,
    IntakeGraph,
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
    intake_graph: IntakeGraph,
    flow_graph_generator: FlowGraphGenerator,
    avatar_assignment: AvatarAssignment,
    *,
    llm: LLMProvider | None = None,
    kb_ingestor: KnowledgeBaseIngestor | None = None,
    tool_bindings: list[ToolBinding] | None = None,
    guardrails: list[str] | None = None,
    channels: list[Literal["phone", "web", "api"]] | None = None,
    persist: bool = True,
    engine: Engine | None = None,
) -> AgentSpec:
    """Drive intake to completion, generate a flow graph, ingest any reference
    documents, assemble a complete `AgentSpec`, and persist it.

    Args:
        intake_graph: drives the slot-filling conversation; see
            `provisioning.interfaces.IntakeGraph` for the shape expected.
        flow_graph_generator: turns filled slots into a `FlowGraph`.
        avatar_assignment: the avatar_id/voice_id to wire into the spec.
        llm: passed through to `flow_graph_generator`; defaults to
            `MockLLMProvider` for local/dev use since the real backend is
            chosen outside this track and wired in via config.
        kb_ingestor: optional; if given and the intake session collected
            reference documents, they're ingested into a knowledge base.
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
    log.info("session_start")

    intake_result: IntakeSessionResult = await intake_graph.run_to_completion()

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
