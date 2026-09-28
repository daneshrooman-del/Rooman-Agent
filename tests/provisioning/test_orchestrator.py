from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy.engine import Engine

from trackb.contracts.models import FlowGraph, FlowState
from trackb.intake.schema import IntakeSlots
from trackb.provisioning.interfaces import AvatarAssignment, IntakeSessionResult
from trackb.provisioning.orchestrator import IncompleteIntakeError, run_intake_session
from trackb.provisioning.store import get_agent_spec, get_engine


def _complete_slots() -> IntakeSlots:
    return IntakeSlots(
        purpose="an agent that takes HR placement calls",
        caller_persona="HR teams",
        required_inputs=["job requirements"],
        workflow_steps=["confirm role", "screen candidate", "schedule interview"],
        tools_needed=["ATS"],
        tone="professional and warm",
        languages=["en"],
    )


class FakeFlowGraphGenerator:
    def __init__(self) -> None:
        self.calls: list[IntakeSlots] = []

    async def __call__(self, slots: IntakeSlots, llm: object) -> FlowGraph:
        self.calls.append(slots)
        return FlowGraph(
            entry_state="greet",
            states=[FlowState(name="greet", objective="Greet the caller", is_terminal=True)],
        )


class FakeKnowledgeBaseIngestor:
    def __init__(self, kb_id: str = "kb-fake-1") -> None:
        self.kb_id = kb_id
        self.calls: list[tuple[str, list[str]]] = []

    async def __call__(self, agent_id: str, documents: list[str]) -> str:
        self.calls.append((agent_id, documents))
        return self.kb_id


@pytest.fixture
def test_engine(tmp_path: Path) -> Engine:
    db_path = tmp_path / "provisioning_test.db"
    return get_engine(f"sqlite:///{db_path}")


@pytest.mark.asyncio
async def test_run_intake_session_assembles_valid_agent_spec(test_engine: Engine) -> None:
    intake_result = IntakeSessionResult(
        slots=_complete_slots(), session_id="session-1", owner="user-1"
    )
    flow_generator = FakeFlowGraphGenerator()
    avatar_assignment = AvatarAssignment(avatar_id="stub-avatar-1", voice_id="voice-1")

    spec = await run_intake_session(
        intake_result,
        avatar_assignment,
        flow_graph_generator=flow_generator,
        engine=test_engine,
    )

    assert spec.owner == "user-1"
    assert spec.purpose == "an agent that takes HR placement calls"
    assert spec.created_from_session_id == "session-1"
    assert spec.avatar_id == "stub-avatar-1"
    assert spec.voice_id == "voice-1"
    assert spec.status == "draft"
    assert spec.flow_graph.entry_state == "greet"
    assert spec.knowledge_base_id is None
    assert spec.guardrails
    assert flow_generator.calls == [intake_result.slots]

    persisted = get_agent_spec(spec.agent_id, engine=test_engine)
    assert persisted == spec


@pytest.mark.asyncio
async def test_run_intake_session_ingests_reference_documents(test_engine: Engine) -> None:
    intake_result = IntakeSessionResult(
        slots=_complete_slots(),
        session_id="session-2",
        owner="user-2",
        reference_documents=["doc-1", "doc-2"],
    )
    ingestor = FakeKnowledgeBaseIngestor(kb_id="kb-42")
    avatar_assignment = AvatarAssignment(avatar_id="stub-avatar-2", voice_id="voice-2")

    spec = await run_intake_session(
        intake_result,
        avatar_assignment,
        flow_graph_generator=FakeFlowGraphGenerator(),
        kb_ingestor=ingestor,
        engine=test_engine,
    )

    assert spec.knowledge_base_id == "kb-42"
    assert len(ingestor.calls) == 1
    called_agent_id, called_docs = ingestor.calls[0]
    assert called_agent_id == spec.agent_id
    assert called_docs == ["doc-1", "doc-2"]


@pytest.mark.asyncio
async def test_run_intake_session_raises_on_incomplete_slots(test_engine: Engine) -> None:
    incomplete_slots = IntakeSlots(purpose="something")  # missing required slots
    intake_result = IntakeSessionResult(
        slots=incomplete_slots, session_id="session-3", owner="user-3"
    )
    avatar_assignment = AvatarAssignment(avatar_id="stub-avatar-3", voice_id="voice-3")

    with pytest.raises(IncompleteIntakeError) as exc_info:
        await run_intake_session(
            intake_result,
            avatar_assignment,
            flow_graph_generator=FakeFlowGraphGenerator(),
            engine=test_engine,
        )

    assert "caller_persona" in exc_info.value.missing_slots

    from trackb.provisioning.store import list_agent_specs

    assert list_agent_specs(engine=test_engine) == []
