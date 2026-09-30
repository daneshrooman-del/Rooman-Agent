"""Proves the pieces built by four separate, parallel agents actually connect:

IntakeGraph (turn-by-turn slot-filling) -> IntakeSessionResult -> run_intake_session
(orchestrator, using the real flowgen module) -> a persisted, valid AgentSpec.

Each module has its own unit tests in isolation (tests/intake, tests/flowgen,
tests/kb, tests/provisioning); this test is the one place that exercises them
wired together the way a real caller (the API layer / LiveKit session loop)
would, using only the public entry points each track's conventions promised.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy.engine import Engine

from trackb.contracts.models import FlowGraph, FlowState, FlowTransition
from trackb.intake.graph import IntakeGraph
from trackb.intake.schema import IntakeSlots
from trackb.llm.mock import MockLLMProvider
from trackb.provisioning.interfaces import AvatarAssignment, IntakeSessionResult
from trackb.provisioning.orchestrator import run_intake_session
from trackb.provisioning.store import get_agent_spec, get_engine


@pytest.fixture
def test_engine(tmp_path: Path) -> Engine:
    db_path = tmp_path / "integration_test.db"
    return get_engine(f"sqlite:///{db_path}")


class _ScriptedIntakeExtractor:
    """Simulates a real requester describing the HR-placement agent from the
    project brief, one fact per turn (the same scenario used throughout the
    R&D plan's example)."""

    def __init__(self) -> None:
        self._responses = [
            IntakeSlots(purpose="an agent that takes HR placement calls"),
            IntakeSlots(caller_persona="HR teams"),
            IntakeSlots(
                workflow_steps=["confirm role", "screen candidate", "schedule interview"]
            ),
            IntakeSlots(languages=["en"]),
        ]
        self._calls = 0

    def __call__(self, _prompt: str, _schema: type) -> IntakeSlots:
        response = self._responses[self._calls]
        self._calls += 1
        return response


def _scripted_flowgen_extract(_prompt: str, _schema: type) -> FlowGraph:
    return FlowGraph(
        entry_state="greet",
        states=[
            FlowState(
                name="greet",
                objective="Greet the caller and confirm the role being discussed",
                transitions=[FlowTransition(on="role_confirmed", to_state="screen_candidate")],
            ),
            FlowState(
                name="screen_candidate",
                objective="Screen the candidate against role requirements",
                transitions=[FlowTransition(on="screening_done", to_state="schedule_interview")],
            ),
            FlowState(
                name="schedule_interview",
                objective="Schedule an interview and confirm details",
                is_terminal=True,
            ),
        ],
    )


@pytest.mark.asyncio
async def test_full_intake_to_agent_spec_pipeline(test_engine: Engine) -> None:
    # 1. Drive the real IntakeGraph turn by turn, exactly as the session/API layer would.
    intake_llm = MockLLMProvider(extract_fn=_ScriptedIntakeExtractor())
    graph = IntakeGraph(intake_llm)

    utterances = [
        "I need an agent that takes HR placement calls.",
        "It'll be used by HR teams.",
        "It should confirm the role, screen the candidate, then schedule an interview.",
        "English is fine.",
    ]
    result = None
    for utterance in utterances:
        result = await graph.step(utterance)
    assert result is not None
    assert result.status == "completed"
    assert result.completed_slots is not None

    # 2. The caller (not IntakeGraph itself) builds the session-level result.
    intake_result = IntakeSessionResult(
        slots=result.completed_slots,
        session_id="integration-session-1",
        owner="user-integration-1",
    )

    # 3. Hand off to provisioning, using the real flow-graph generator (with a
    # scripted LLM so no real network call happens) and skipping KB ingestion
    # since no reference documents were provided in this scenario.
    flow_llm = MockLLMProvider(extract_fn=_scripted_flowgen_extract)
    avatar_assignment = AvatarAssignment(
        avatar_id="avatar-integration-1", voice_id="voice-integration-1"
    )

    from trackb.flowgen import generate_flow_graph

    spec = await run_intake_session(
        intake_result,
        avatar_assignment,
        flow_graph_generator=generate_flow_graph,
        llm=flow_llm,
        engine=test_engine,
    )

    # 4. The result is a complete, valid, persisted AgentSpec.
    assert spec.purpose == "an agent that takes HR placement calls"
    assert spec.avatar_id == "avatar-integration-1"
    assert spec.voice_id == "voice-integration-1"
    assert spec.languages == ["en"]
    assert spec.flow_graph.entry_state == "greet"
    assert any(state.is_terminal for state in spec.flow_graph.states)
    assert spec.created_from_session_id == "integration-session-1"

    persisted = get_agent_spec(spec.agent_id, engine=test_engine)
    assert persisted == spec
