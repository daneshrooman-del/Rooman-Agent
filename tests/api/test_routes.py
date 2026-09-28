from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from trackb.api.app import create_app
from trackb.api.deps import get_db_engine, get_livekit_admin
from trackb.contracts.models import AgentSpec, FlowGraph, FlowState
from trackb.provisioning.store import get_engine, save_agent_spec
from trackb.session.livekit_admin import LiveKitAdminError


class _FakeLiveKitAdmin:
    """Stands in for `LiveKitAdmin`, mocking the boundary to a real LiveKit server."""

    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        self.create_calls: list[tuple[str, str]] = []
        self.token_calls: list[tuple[str, str]] = []

    async def create_intake_room(
        self, session_id: str, agent_name: str = "trackb-intake"
    ) -> Any:
        if self.fail:
            raise LiveKitAdminError("simulated livekit outage")
        self.create_calls.append((session_id, agent_name))
        return SimpleNamespace(name=f"intake-{session_id}", sid="RM_fake")

    async def mint_join_token(
        self, room_name: str, identity: str, *, name: str | None = None
    ) -> str:
        if self.fail:
            raise LiveKitAdminError("simulated livekit outage")
        self.token_calls.append((room_name, identity))
        return f"fake-jwt-for-{identity}"


@pytest.fixture
def test_engine(tmp_path: Path) -> Engine:
    db_path = tmp_path / "api_test.db"
    return get_engine(f"sqlite:///{db_path}")


@pytest.fixture
def fake_livekit_admin() -> _FakeLiveKitAdmin:
    return _FakeLiveKitAdmin()


@pytest.fixture
def client(test_engine: Engine, fake_livekit_admin: _FakeLiveKitAdmin) -> Iterator[TestClient]:
    app = create_app()
    app.dependency_overrides[get_db_engine] = lambda: test_engine
    app.dependency_overrides[get_livekit_admin] = lambda: fake_livekit_admin
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_intake_start_without_livekit_credentials_returns_503_not_500(tmp_path: Path) -> None:
    """Regression test for a bug only found by actually running the app locally (not caught by
    any other test here, since they all override `get_livekit_admin` entirely and so never
    exercise its real construction path). `Settings` defaults to empty LiveKit credentials, and
    `livekit.api.LiveKitAPI.__init__` raises a raw `ValueError` in that case -- that happens
    during FastAPI's dependency resolution, before the route body's own try/except around
    `LiveKitAdmin` *method calls* ever runs, so it must be caught in `get_livekit_admin` itself
    and turned into a clean 503, not surfaced as an unhandled 500."""
    db_path = tmp_path / "livekit_regression_test.db"
    engine = get_engine(f"sqlite:///{db_path}")
    app = create_app()
    app.dependency_overrides[get_db_engine] = lambda: engine
    with TestClient(app) as test_client:
        response = test_client.post("/intake/start", json={"owner": "verify-user"})
    app.dependency_overrides.clear()

    assert response.status_code == 503
    assert "LiveKit is not configured" in response.json()["detail"]


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


def test_intake_start_creates_livekit_room_and_join_token(
    client: TestClient, fake_livekit_admin: _FakeLiveKitAdmin
) -> None:
    response = client.post("/intake/start", json={"owner": "user-1"})

    assert response.status_code == 200
    body = response.json()

    assert body["room_name"] == f"intake-{body['session_id']}"
    assert body["livekit_url"]
    assert body["token"] == "fake-jwt-for-user-1"

    assert fake_livekit_admin.create_calls == [(body["session_id"], "trackb-intake")]
    assert fake_livekit_admin.token_calls == [(body["room_name"], "user-1")]


def test_intake_start_returns_503_when_livekit_room_creation_fails(
    client: TestClient, fake_livekit_admin: _FakeLiveKitAdmin
) -> None:
    fake_livekit_admin.fail = True

    response = client.post("/intake/start", json={"owner": "user-1"})

    assert response.status_code == 503


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
