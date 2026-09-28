from __future__ import annotations

import io
from collections.abc import Iterator
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from trackb.api.app import create_app
from trackb.api.deps import get_db_engine, get_livekit_admin, get_session_store
from trackb.contracts.models import AgentSpec, FlowGraph, FlowState
from trackb.provisioning.store import get_engine, save_agent_spec
from trackb.session.livekit_admin import LiveKitAdminError
from trackb.session.redis_store import SessionRecord


class _FakeLiveKitAdmin:
    """Stands in for `LiveKitAdmin`, mocking the boundary to a real LiveKit server."""

    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        self.create_calls: list[tuple[str, str]] = []
        self.token_calls: list[tuple[str, str]] = []
        self.conversation_create_calls: list[tuple[str, str, str]] = []

    async def create_intake_room(
        self, session_id: str, agent_name: str = "trackb-intake"
    ) -> Any:
        if self.fail:
            raise LiveKitAdminError("simulated livekit outage")
        self.create_calls.append((session_id, agent_name))
        return SimpleNamespace(name=f"intake-{session_id}", sid="RM_fake")

    async def create_conversation_room(
        self, agent_id: str, session_id: str, agent_name: str = "trackb-conversation"
    ) -> Any:
        if self.fail:
            raise LiveKitAdminError("simulated livekit outage")
        self.conversation_create_calls.append((agent_id, session_id, agent_name))
        return SimpleNamespace(name=f"conversation-{agent_id}-{session_id}", sid="RM_fake_conv")

    async def mint_join_token(
        self, room_name: str, identity: str, *, name: str | None = None
    ) -> str:
        if self.fail:
            raise LiveKitAdminError("simulated livekit outage")
        self.token_calls.append((room_name, identity))
        return f"fake-jwt-for-{identity}"


class _FakeSessionStore:
    """Stands in for `RedisSessionStore`, mocking the boundary to a real Redis server."""

    def __init__(self) -> None:
        self.saved: dict[str, SessionRecord] = {}
        self.reference_documents: dict[str, list[str]] = {}

    async def save_session(
        self,
        session_id: str,
        *,
        owner: str,
        avatar_id: str | None = None,
        voice_id: str | None = None,
    ) -> SessionRecord:
        record = SessionRecord(
            session_id=session_id, owner=owner, avatar_id=avatar_id, voice_id=voice_id
        )
        self.saved[session_id] = record
        return record

    async def get_session(self, session_id: str) -> SessionRecord | None:
        return self.saved.get(session_id)

    async def add_reference_document(self, session_id: str, text: str) -> None:
        self.reference_documents.setdefault(session_id, []).append(text)

    async def get_reference_documents(self, session_id: str) -> list[str]:
        return list(self.reference_documents.get(session_id, []))

    async def clear_reference_documents(self, session_id: str) -> None:
        self.reference_documents.pop(session_id, None)


@pytest.fixture
def test_engine(tmp_path: Path) -> Engine:
    db_path = tmp_path / "api_test.db"
    return get_engine(f"sqlite:///{db_path}")


@pytest.fixture
def fake_livekit_admin() -> _FakeLiveKitAdmin:
    return _FakeLiveKitAdmin()


@pytest.fixture
def fake_session_store() -> _FakeSessionStore:
    return _FakeSessionStore()


@pytest.fixture
def client(
    test_engine: Engine,
    fake_livekit_admin: _FakeLiveKitAdmin,
    fake_session_store: _FakeSessionStore,
) -> Iterator[TestClient]:
    app = create_app()
    app.dependency_overrides[get_db_engine] = lambda: test_engine
    app.dependency_overrides[get_livekit_admin] = lambda: fake_livekit_admin
    app.dependency_overrides[get_session_store] = lambda: fake_session_store
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


def test_intake_start_persists_session_metadata_to_session_store(
    client: TestClient, fake_session_store: _FakeSessionStore
) -> None:
    response = client.post("/intake/start", json={"owner": "user-1"})

    assert response.status_code == 200
    session_id = response.json()["session_id"]

    saved = fake_session_store.saved[session_id]
    assert saved.owner == "user-1"
    assert saved.voice_id == "voice-default"


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


def test_conversation_start_for_missing_agent_returns_404_even_without_livekit_credentials(
    tmp_path: Path,
) -> None:
    """Regression test for a bug only found by actually running the app locally: a missing
    agent_id must 404 regardless of whether LiveKit is configured. FastAPI resolves a route's
    `Depends` params in declaration order and stops at the first one that raises, so if the
    agent-existence check only lived in the route body (after `Depends(get_livekit_admin)` had
    already run), a request for a nonexistent agent against an unconfigured LiveKit surfaced a
    misleading 503 instead of 404 -- see `_existing_agent_spec`'s docstring in `api/routes.py`.
    This test intentionally does NOT override `get_livekit_admin`, so it exercises the real
    (unconfigured-by-default) dependency, same as
    `test_intake_start_without_livekit_credentials_returns_503_not_500` above.
    """
    db_path = tmp_path / "conversation_404_regression_test.db"
    engine = get_engine(f"sqlite:///{db_path}")
    app = create_app()
    app.dependency_overrides[get_db_engine] = lambda: engine
    with TestClient(app) as test_client:
        response = test_client.post("/agents/does-not-exist/conversation/start")
    app.dependency_overrides.clear()

    assert response.status_code == 404


def test_conversation_start_for_existing_agent_creates_livekit_room_and_join_token(
    client: TestClient, test_engine: Engine, fake_livekit_admin: _FakeLiveKitAdmin
) -> None:
    spec = _make_spec("agent-1")
    save_agent_spec(spec, engine=test_engine)

    response = client.post("/agents/agent-1/conversation/start")

    assert response.status_code == 200
    body = response.json()
    assert body["agent_id"] == "agent-1"
    assert body["status"] == "pending"
    assert isinstance(body["session_id"], str) and body["session_id"]
    assert body["room_name"] == f"conversation-agent-1-{body['session_id']}"
    assert body["livekit_url"]
    assert body["token"] == "fake-jwt-for-owner-1"

    assert fake_livekit_admin.conversation_create_calls == [
        ("agent-1", body["session_id"], "trackb-conversation")
    ]
    assert fake_livekit_admin.token_calls == [(body["room_name"], "owner-1")]


def test_conversation_start_returns_503_when_livekit_room_creation_fails(
    client: TestClient, test_engine: Engine, fake_livekit_admin: _FakeLiveKitAdmin
) -> None:
    spec = _make_spec("agent-1")
    save_agent_spec(spec, engine=test_engine)
    fake_livekit_admin.fail = True

    response = client.post("/agents/agent-1/conversation/start")

    assert response.status_code == 503


def _minimal_pdf_bytes(text: str) -> bytes:
    """Build a real, minimally-valid one-page PDF containing `text`, using pypdf's own writer
    -- proves the upload route's `pypdf.PdfReader.extract_text()` usage against real PDF bytes
    rather than a mocked-away pypdf."""
    from pypdf import PdfWriter
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

    writer = PdfWriter()
    page = writer.add_blank_page(width=300, height=300)

    content = f"BT /F1 18 Tf 20 250 Td ({text}) Tj ET"
    stream_obj = DecodedStreamObject()
    stream_obj.set_data(content.encode("latin-1"))
    stream_ref = writer._add_object(stream_obj)
    page[NameObject("/Contents")] = stream_ref

    font = DictionaryObject()
    font[NameObject("/Type")] = NameObject("/Font")
    font[NameObject("/Subtype")] = NameObject("/Type1")
    font[NameObject("/BaseFont")] = NameObject("/Helvetica")
    font_ref = writer._add_object(font)

    resources = DictionaryObject()
    fonts_dict = DictionaryObject()
    fonts_dict[NameObject("/F1")] = font_ref
    resources[NameObject("/Font")] = fonts_dict
    page[NameObject("/Resources")] = resources

    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def test_upload_reference_document_txt_succeeds_and_lands_in_store(
    client: TestClient, fake_session_store: _FakeSessionStore
) -> None:
    start_response = client.post("/intake/start", json={"owner": "user-1"})
    session_id = start_response.json()["session_id"]

    response = client.post(
        f"/intake/{session_id}/documents",
        files={
            "file": ("job-description.txt", b"We need a senior backend engineer.", "text/plain")
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["session_id"] == session_id
    assert body["documents_count"] == 1
    assert body["characters_extracted"] == len("We need a senior backend engineer.")
    assert fake_session_store.reference_documents[session_id] == [
        "We need a senior backend engineer."
    ]


def test_upload_reference_document_pdf_extracts_real_text(
    client: TestClient, fake_session_store: _FakeSessionStore
) -> None:
    start_response = client.post("/intake/start", json={"owner": "user-1"})
    session_id = start_response.json()["session_id"]
    pdf_bytes = _minimal_pdf_bytes("Job description reference text")

    response = client.post(
        f"/intake/{session_id}/documents",
        files={"file": ("job-description.pdf", pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["documents_count"] == 1
    assert body["characters_extracted"] > 0
    stored = fake_session_store.reference_documents[session_id]
    assert len(stored) == 1
    assert "Job description reference text" in stored[0]


def test_upload_reference_document_unsupported_type_returns_4xx(
    client: TestClient,
) -> None:
    start_response = client.post("/intake/start", json={"owner": "user-1"})
    session_id = start_response.json()["session_id"]

    response = client.post(
        f"/intake/{session_id}/documents",
        files={"file": ("photo.png", b"\x89PNG\r\n fake bytes", "image/png")},
    )

    assert 400 <= response.status_code < 500
    assert response.status_code == 415
    assert ".txt" in response.json()["detail"]
    assert ".pdf" in response.json()["detail"]


def test_upload_reference_document_corrupt_pdf_returns_4xx_not_500(
    client: TestClient,
) -> None:
    start_response = client.post("/intake/start", json={"owner": "user-1"})
    session_id = start_response.json()["session_id"]

    response = client.post(
        f"/intake/{session_id}/documents",
        files={"file": ("broken.pdf", b"not actually a pdf", "application/pdf")},
    )

    assert 400 <= response.status_code < 500


def test_upload_reference_document_nonexistent_session_returns_404(
    client: TestClient,
) -> None:
    response = client.post(
        "/intake/does-not-exist/documents",
        files={"file": ("job-description.txt", b"some text", "text/plain")},
    )

    assert response.status_code == 404


def test_upload_reference_document_appends_across_multiple_uploads(
    client: TestClient, fake_session_store: _FakeSessionStore
) -> None:
    start_response = client.post("/intake/start", json={"owner": "user-1"})
    session_id = start_response.json()["session_id"]

    first = client.post(
        f"/intake/{session_id}/documents",
        files={"file": ("first.txt", b"first document text", "text/plain")},
    )
    second = client.post(
        f"/intake/{session_id}/documents",
        files={"file": ("second.txt", b"second document text", "text/plain")},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["documents_count"] == 2
    assert fake_session_store.reference_documents[session_id] == [
        "first document text",
        "second document text",
    ]
