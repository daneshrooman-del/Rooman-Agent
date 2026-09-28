from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from trackb.api.app import create_app
from trackb.api.deps import get_db_engine
from trackb.contracts.models import AgentSpec, FlowGraph, FlowState
from trackb.provisioning.store import get_engine, save_agent_spec


@pytest.fixture
def test_engine(tmp_path) -> Engine:
    db_path = tmp_path / "api_test.db"
    return get_engine(f"sqlite:///{db_path}")


@pytest.fixture
def client(test_engine: Engine) -> Iterator[TestClient]:
    app = create_app()
    app.dependency_overrides[get_db_engine] = lambda: test_engine
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _make_spec(agent_id: str) -> AgentSpec:
    return AgentSpec(
        agent_id=agent_id,
        owner="owner-1",
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


def test_intake_start_returns_session_id(client: TestClient) -> None:
    response = client.post("/intake/start", json={"owner": "user-1"})

    assert response.status_code == 200
    body = response.json()
    assert body["owner"] == "user-1"
    assert body["status"] == "started"
    assert body["avatar_id"] is None
    assert isinstance(body["session_id"], str) and body["session_id"]


def test_intake_start_with_reference_video_creates_stub_avatar(client: TestClient) -> None:
    response = client.post(
        "/intake/start", json={"owner": "user-1", "has_reference_video": True}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["avatar_id"] is not None
    assert body["avatar_id"].startswith("stub-avatar-")


def test_get_agent_not_found_returns_404(client: TestClient) -> None:
    response = client.get("/agents/does-not-exist")

    assert response.status_code == 404


def test_get_agent_returns_persisted_spec(client: TestClient, test_engine: Engine) -> None:
    spec = _make_spec("agent-1")
    save_agent_spec(spec, engine=test_engine)

    response = client.get("/agents/agent-1")

    assert response.status_code == 200
    assert AgentSpec.model_validate(response.json()) == spec


def test_list_agents_returns_all_persisted_specs(client: TestClient, test_engine: Engine) -> None:
    save_agent_spec(_make_spec("agent-1"), engine=test_engine)
    save_agent_spec(_make_spec("agent-2"), engine=test_engine)

    response = client.get("/agents")

    assert response.status_code == 200
    agent_ids = {agent["agent_id"] for agent in response.json()}
    assert agent_ids == {"agent-1", "agent-2"}


def test_conversation_start_for_missing_agent_returns_404(client: TestClient) -> None:
    response = client.post("/agents/does-not-exist/conversation/start")

    assert response.status_code == 404


def test_conversation_start_for_existing_agent_returns_session(
    client: TestClient, test_engine: Engine
) -> None:
    spec = _make_spec("agent-1")
    save_agent_spec(spec, engine=test_engine)

    response = client.post("/agents/agent-1/conversation/start")

    assert response.status_code == 200
    body = response.json()
    assert body["agent_id"] == "agent-1"
    assert body["status"] == "pending"
    assert isinstance(body["session_id"], str) and body["session_id"]
    assert "agent-1" in body["room_name"]
