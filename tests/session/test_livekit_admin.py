from __future__ import annotations

import time

import jwt
import pytest
from livekit import api

from trackb.config import Settings
from trackb.session.livekit_admin import (
    DEFAULT_AGENT_NAME,
    DEFAULT_CONVERSATION_AGENT_NAME,
    LiveKitAdmin,
    LiveKitAdminError,
    conversation_room_name,
    room_name_for_session,
    session_id_from_conversation_room_name,
)


def _settings() -> Settings:
    return Settings(
        livekit_url="wss://test.livekit.cloud",
        livekit_api_key="test-key",
        livekit_api_secret="test-secret-that-is-at-least-32-bytes-long",
    )


class _FakeRoomService:
    def __init__(
        self,
        room: api.Room | None = None,
        fail_times: int = 0,
        exc: type[Exception] = RuntimeError,
    ) -> None:
        self.calls: list[api.CreateRoomRequest] = []
        self._room = room
        self._fail_times = fail_times
        self._exc = exc

    async def create_room(self, request: api.CreateRoomRequest) -> api.Room:
        self.calls.append(request)
        if self._fail_times > 0:
            self._fail_times -= 1
            raise self._exc("simulated livekit failure")
        assert self._room is not None
        return self._room


class _FakeLiveKitAPI:
    def __init__(self, room_service: _FakeRoomService) -> None:
        self.room = room_service
        self.aclose_called = False

    async def aclose(self) -> None:
        self.aclose_called = True


def test_room_name_for_session_is_deterministic() -> None:
    assert room_name_for_session("abc-123") == "intake-abc-123"
    assert room_name_for_session("abc-123") == room_name_for_session("abc-123")


@pytest.mark.asyncio
async def test_create_intake_room_dispatches_configured_agent() -> None:
    fake_room = api.Room(name="intake-session-1", sid="RM_test123")
    room_service = _FakeRoomService(room=fake_room)
    admin = LiveKitAdmin(settings=_settings(), client=_FakeLiveKitAPI(room_service))  # type: ignore[arg-type]

    result = await admin.create_intake_room("session-1")

    assert result.name == "intake-session-1"
    assert result.sid == "RM_test123"
    assert len(room_service.calls) == 1

    request = room_service.calls[0]
    assert request.name == "intake-session-1"
    assert len(request.agents) == 1
    assert request.agents[0].agent_name == DEFAULT_AGENT_NAME


@pytest.mark.asyncio
async def test_create_intake_room_accepts_custom_agent_name() -> None:
    fake_room = api.Room(name="intake-session-2", sid="RM_test456")
    room_service = _FakeRoomService(room=fake_room)
    admin = LiveKitAdmin(settings=_settings(), client=_FakeLiveKitAPI(room_service))  # type: ignore[arg-type]

    await admin.create_intake_room("session-2", agent_name="custom-agent")

    assert room_service.calls[0].agents[0].agent_name == "custom-agent"


@pytest.mark.asyncio
async def test_create_intake_room_retries_transient_failures_then_succeeds() -> None:
    fake_room = api.Room(name="intake-session-3", sid="RM_test789")
    room_service = _FakeRoomService(room=fake_room, fail_times=2)
    admin = LiveKitAdmin(settings=_settings(), client=_FakeLiveKitAPI(room_service))  # type: ignore[arg-type]

    result = await admin.create_intake_room("session-3")

    assert result.name == "intake-session-3"
    assert len(room_service.calls) == 3


@pytest.mark.asyncio
async def test_create_intake_room_raises_clear_error_after_retries_exhausted() -> None:
    room_service = _FakeRoomService(fail_times=10)
    admin = LiveKitAdmin(settings=_settings(), client=_FakeLiveKitAPI(room_service))  # type: ignore[arg-type]

    with pytest.raises(LiveKitAdminError, match="intake-session-4"):
        await admin.create_intake_room("session-4")

    # stop_after_attempt(3): exactly 3 attempts, never hangs, never raises the raw
    # underlying exception.
    assert len(room_service.calls) == 3


@pytest.mark.asyncio
async def test_mint_join_token_grants_room_join_for_identity() -> None:
    admin = LiveKitAdmin(settings=_settings(), client=_FakeLiveKitAPI(_FakeRoomService()))  # type: ignore[arg-type]

    token = await admin.mint_join_token("intake-session-5", identity="owner-1")

    payload = jwt.decode(token, options={"verify_signature": False})
    assert payload["sub"] == "owner-1"
    assert payload["video"]["room"] == "intake-session-5"
    assert payload["video"]["roomJoin"] is True
    assert payload["exp"] > time.time()


@pytest.mark.asyncio
async def test_mint_join_token_raises_clear_error_on_invalid_grant() -> None:
    admin = LiveKitAdmin(settings=_settings(), client=_FakeLiveKitAPI(_FakeRoomService()))  # type: ignore[arg-type]

    with pytest.raises(LiveKitAdminError, match="room-x"):
        # AccessToken.to_jwt() itself rejects a room_join grant with no identity.
        await admin.mint_join_token("room-x", identity="")


@pytest.mark.asyncio
async def test_aclose_delegates_to_underlying_client() -> None:
    fake_client = _FakeLiveKitAPI(_FakeRoomService())
    admin = LiveKitAdmin(settings=_settings(), client=fake_client)  # type: ignore[arg-type]

    await admin.aclose()

    assert fake_client.aclose_called is True


def test_conversation_room_name_is_deterministic() -> None:
    assert conversation_room_name("agent-1", "sess-1") == "conversation-agent-1-sess-1"
    assert conversation_room_name("agent-1", "sess-1") == conversation_room_name(
        "agent-1", "sess-1"
    )


def test_session_id_from_conversation_room_name_strips_known_agent_id_prefix() -> None:
    room_name = conversation_room_name("agent-1", "sess-with-hyphens-123")

    assert (
        session_id_from_conversation_room_name(room_name, "agent-1") == "sess-with-hyphens-123"
    )


def test_session_id_from_conversation_room_name_returns_none_for_mismatched_prefix() -> None:
    room_name = conversation_room_name("agent-1", "sess-1")

    assert session_id_from_conversation_room_name(room_name, "some-other-agent") is None


@pytest.mark.asyncio
async def test_create_conversation_room_dispatches_agent_with_agent_id_metadata() -> None:
    fake_room = api.Room(name="conversation-agent-1-sess-1", sid="RM_conv123")
    room_service = _FakeRoomService(room=fake_room)
    admin = LiveKitAdmin(settings=_settings(), client=_FakeLiveKitAPI(room_service))  # type: ignore[arg-type]

    result = await admin.create_conversation_room("agent-1", "sess-1")

    assert result.name == "conversation-agent-1-sess-1"
    assert len(room_service.calls) == 1

    request = room_service.calls[0]
    assert request.name == "conversation-agent-1-sess-1"
    assert request.metadata == "agent-1"
    assert len(request.agents) == 1
    assert request.agents[0].agent_name == DEFAULT_CONVERSATION_AGENT_NAME
    assert request.agents[0].metadata == "agent-1"


@pytest.mark.asyncio
async def test_create_conversation_room_accepts_custom_agent_name() -> None:
    fake_room = api.Room(name="conversation-agent-1-sess-2", sid="RM_conv456")
    room_service = _FakeRoomService(room=fake_room)
    admin = LiveKitAdmin(settings=_settings(), client=_FakeLiveKitAPI(room_service))  # type: ignore[arg-type]

    await admin.create_conversation_room("agent-1", "sess-2", agent_name="custom-conv-agent")

    assert room_service.calls[0].agents[0].agent_name == "custom-conv-agent"


@pytest.mark.asyncio
async def test_create_conversation_room_raises_clear_error_after_retries_exhausted() -> None:
    room_service = _FakeRoomService(fail_times=10)
    admin = LiveKitAdmin(settings=_settings(), client=_FakeLiveKitAPI(room_service))  # type: ignore[arg-type]

    with pytest.raises(LiveKitAdminError, match="conversation-agent-1-sess-3"):
        await admin.create_conversation_room("agent-1", "sess-3")

    assert len(room_service.calls) == 3


@pytest.mark.asyncio
async def test_admin_usable_as_async_context_manager() -> None:
    fake_client = _FakeLiveKitAPI(_FakeRoomService())

    async with LiveKitAdmin(settings=_settings(), client=fake_client) as admin:  # type: ignore[arg-type]
        assert admin is not None

    assert fake_client.aclose_called is True
