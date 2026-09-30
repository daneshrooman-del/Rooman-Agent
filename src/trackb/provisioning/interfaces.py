"""Supporting types for `provisioning.orchestrator.run_intake_session`.

`IntakeSessionResult` is what the caller (Track C's API layer, or the LiveKit
session loop) hands to provisioning once an intake conversation has actually
finished -- driving the turn-by-turn conversation itself is
`trackb.intake.graph.IntakeGraph.step()`'s job, called once per user utterance
by whoever owns the live session; provisioning only ever sees the *completed*
result, never drives the conversation itself.

`FlowGraphGenerator` and `KnowledgeBaseIngestor` are still Protocols (rather
than importing `trackb.flowgen.generate_flow_graph` / `trackb.kb.ingest`
directly as hard defaults everywhere) so tests can inject fakes without
needing a real LLM or Qdrant.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

from trackb.contracts.models import FlowGraph
from trackb.intake.schema import IntakeSlots
from trackb.llm.base import LLMProvider


@dataclass
class IntakeSessionResult:
    """The finished output of an intake conversation.

    Constructed by whoever drove `IntakeGraph.step()` to completion (session_id
    and owner come from that caller's own session bookkeeping, not from
    `IntakeGraph` itself), once `IntakeStepResult.status == "completed"`.
    """

    slots: IntakeSlots
    session_id: str
    owner: str
    reference_documents: list[str] = field(default_factory=list)
    """Raw text of any reference documents to ingest into a knowledge base.

    Not part of `IntakeSlots` -- these are expected to come from a separate
    upload/attachment alongside the conversation, not from a slot the LLM
    extracts. Whoever wires document upload end-to-end is responsible for
    turning uploaded files into plain text before this point.
    """


@runtime_checkable
class FlowGraphGenerator(Protocol):
    """Matches `trackb.flowgen.generate_flow_graph(slots, llm) -> FlowGraph`."""

    async def __call__(self, slots: IntakeSlots, llm: LLMProvider) -> FlowGraph: ...


@runtime_checkable
class KnowledgeBaseIngestor(Protocol):
    """Matches `trackb.kb.ingest(agent_id, documents) -> knowledge_base_id`."""

    async def __call__(self, agent_id: str, documents: list[str]) -> str: ...


@dataclass
class AvatarAssignment:
    """Which avatar/voice to wire into the provisioned AgentSpec.

    Track A's real avatar-assignment flow (matching a user's chosen look/voice
    to an `avatar_id`/`voice_id` pair) isn't built yet. Callers construct this
    directly for now -- e.g. from a `StubAvatarServiceClient.create_avatar()`
    call plus a chosen voice identifier.
    """

    avatar_id: str
    voice_id: str
