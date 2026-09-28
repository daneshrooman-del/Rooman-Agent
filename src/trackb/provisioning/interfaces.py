"""Placeholder shapes for dependencies owned by the other agents/tracks working
concurrently on this branch.

`run_intake_session` below needs to compose three pieces of behavior that do
not exist as importable code yet:

  - `IntakeGraph`      -- stands in for `trackb.intake.graph.IntakeGraph`
  - `FlowGraphGenerator` -- stands in for `trackb.flowgen.generate_flow_graph`
  - `KnowledgeBaseIngestor` -- stands in for `trackb.kb.ingest`

These are structural `Protocol`s so any object/callable with a matching shape
satisfies them -- tests supply plain fakes, and once the real modules land,
either the real objects should already satisfy these Protocols, or this file
should be updated to match whatever shape they actually land with (favor
updating this file over the real one, since it postdates it).

Do not delete these once the real modules exist unless nothing else refers to
them -- update `orchestrator.py`'s imports to use the real ones instead.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

from trackb.contracts.models import FlowGraph
from trackb.intake.schema import IntakeSlots
from trackb.llm.base import LLMProvider


@dataclass
class IntakeSessionResult:
    """What driving an intake conversation to completion produces.

    Placeholder for whatever `IntakeGraph.run_to_completion()` (or similar)
    ends up returning from `trackb.intake.graph`.
    """

    slots: IntakeSlots
    session_id: str
    owner: str
    reference_documents: list[bytes] = field(default_factory=list)


@runtime_checkable
class IntakeGraph(Protocol):
    """Placeholder for `trackb.intake.graph.IntakeGraph`.

    The real class drives the slot-filling conversation turn by turn over a
    LiveKit room; here we only need the fact that, once the conversation is
    done, it can be asked for the final result.
    """

    async def run_to_completion(self) -> IntakeSessionResult: ...


@runtime_checkable
class FlowGraphGenerator(Protocol):
    """Placeholder for `trackb.flowgen.generate_flow_graph(slots, llm) -> FlowGraph`."""

    async def __call__(self, slots: IntakeSlots, llm: LLMProvider) -> FlowGraph: ...


@runtime_checkable
class KnowledgeBaseIngestor(Protocol):
    """Placeholder for `trackb.kb.ingest(agent_id, documents) -> knowledge_base_id`."""

    async def __call__(self, agent_id: str, documents: list[bytes]) -> str: ...


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
