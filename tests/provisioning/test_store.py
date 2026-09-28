from __future__ import annotations

import pytest
from sqlalchemy.engine import Engine

from trackb.contracts.models import AgentSpec, FlowGraph, FlowState
from trackb.provisioning.store import get_agent_spec, get_engine, list_agent_specs, save_agent_spec


@pytest.fixture
def test_engine(tmp_path) -> Engine:
    db_path = tmp_path / "store_test.db"
    return get_engine(f"sqlite:///{db_path}")


def _make_spec(agent_id: str, owner: str = "owner-1") -> AgentSpec:
    return AgentSpec(
        agent_id=agent_id,
        owner=owner,
        purpose="a test agent",
        persona_prompt="You are a test agent.",
        flow_graph=FlowGraph(
            entry_state="start",
            states=[FlowState(name="start", objective="do the thing", is_terminal=True)],
        ),
        avatar_id="avatar-1",
        voice_id="voice-1",
        created_from_session_id="session-1",
    )


def test_get_agent_spec_returns_none_when_missing(test_engine: Engine) -> None:
    assert get_agent_spec("does-not-exist", engine=test_engine) is None


def test_save_and_get_round_trips(test_engine: Engine) -> None:
    spec = _make_spec("agent-1")

    save_agent_spec(spec, engine=test_engine)
    restored = get_agent_spec("agent-1", engine=test_engine)

    assert restored == spec


def test_save_agent_spec_upserts_existing_row(test_engine: Engine) -> None:
    spec = _make_spec("agent-1")
    save_agent_spec(spec, engine=test_engine)

    updated = spec.model_copy(update={"status": "active"})
    save_agent_spec(updated, engine=test_engine)

    restored = get_agent_spec("agent-1", engine=test_engine)
    assert restored is not None
    assert restored.status == "active"
    assert list_agent_specs(engine=test_engine) == [updated]


def test_list_agent_specs_returns_all_saved(test_engine: Engine) -> None:
    spec_a = _make_spec("agent-a")
    spec_b = _make_spec("agent-b", owner="owner-2")

    save_agent_spec(spec_a, engine=test_engine)
    save_agent_spec(spec_b, engine=test_engine)

    specs = list_agent_specs(engine=test_engine)
    assert {s.agent_id for s in specs} == {"agent-a", "agent-b"}
