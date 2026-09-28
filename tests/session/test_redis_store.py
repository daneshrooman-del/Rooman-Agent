from __future__ import annotations

import pytest

from trackb.config import Settings
from trackb.intake.schema import IntakeSlots
from trackb.session.redis_store import RedisSessionStore, SessionStoreError


class _FakeRedisClient:
    """Stands in for `redis.asyncio.Redis`, mocking the boundary to a real Redis server."""

    def __init__(self, fail: bool = False, fail_times: int = 0) -> None:
        self.data: dict[str, str] = {}
        self.ttls: dict[str, int | None] = {}
        self.fail = fail
        self.fail_times = fail_times
        self.set_calls: list[tuple[str, str, int | None]] = []

    def _maybe_fail(self) -> None:
        if self.fail:
            raise ConnectionError("simulated redis outage")
        if self.fail_times > 0:
            self.fail_times -= 1
            raise ConnectionError("simulated transient redis outage")

    async def set(self, key: str, value: str, ex: int | None = None) -> bool:
        self._maybe_fail()
        self.data[key] = value
        self.ttls[key] = ex
        self.set_calls.append((key, value, ex))
        return True

    async def get(self, key: str) -> bytes | None:
        self._maybe_fail()
        value = self.data.get(key)
        return value.encode("utf-8") if value is not None else None

    async def delete(self, key: str) -> int:
        self._maybe_fail()
        existed = key in self.data
        self.data.pop(key, None)
        self.ttls.pop(key, None)
        return 1 if existed else 0

    async def aclose(self) -> None:
        pass


def _store(client: _FakeRedisClient, ttl_seconds: int = 3600) -> RedisSessionStore:
    settings = Settings(session_state_ttl_seconds=ttl_seconds)
    return RedisSessionStore(settings=settings, redis_client=client)  # type: ignore[arg-type]


async def test_save_and_get_session_round_trip() -> None:
    client = _FakeRedisClient()
    store = _store(client)

    saved = await store.save_session(
        "sess-1", owner="owner-1", avatar_id="avatar-1", voice_id="voice-1"
    )
    assert saved.session_id == "sess-1"

    loaded = await store.get_session("sess-1")
    assert loaded is not None
    assert loaded.session_id == "sess-1"
    assert loaded.owner == "owner-1"
    assert loaded.avatar_id == "avatar-1"
    assert loaded.voice_id == "voice-1"


async def test_get_session_returns_none_when_nothing_saved() -> None:
    store = _store(_FakeRedisClient())

    assert await store.get_session("does-not-exist") is None


async def test_save_and_load_intake_progress_round_trip() -> None:
    client = _FakeRedisClient()
    store = _store(client)
    slots = IntakeSlots(purpose="take HR calls", caller_persona="HR teams")
    history = ["I want an HR agent", "HR teams will use it"]

    await store.save_intake_progress("sess-2", slots, history)
    loaded = await store.load_intake_progress("sess-2")

    assert loaded is not None
    loaded_slots, loaded_history = loaded
    assert loaded_slots.purpose == "take HR calls"
    assert loaded_slots.caller_persona == "HR teams"
    assert loaded_history == history


async def test_load_intake_progress_returns_none_when_nothing_saved() -> None:
    store = _store(_FakeRedisClient())

    assert await store.load_intake_progress("sess-does-not-exist") is None


async def test_clear_intake_progress_removes_it() -> None:
    client = _FakeRedisClient()
    store = _store(client)
    await store.save_intake_progress("sess-3", IntakeSlots(purpose="p"), ["utterance one"])

    await store.clear_intake_progress("sess-3")

    assert await store.load_intake_progress("sess-3") is None


async def test_clear_session_removes_it() -> None:
    client = _FakeRedisClient()
    store = _store(client)
    await store.save_session("sess-4", owner="owner-4")

    await store.clear_session("sess-4")

    assert await store.get_session("sess-4") is None


async def test_writes_set_ttl_from_settings() -> None:
    client = _FakeRedisClient()
    store = _store(client, ttl_seconds=999)

    await store.save_session("sess-5", owner="owner-5")
    await store.save_intake_progress("sess-5", IntakeSlots(), [])

    assert all(ex == 999 for _, _, ex in client.set_calls)
    assert len(client.set_calls) == 2


async def test_transient_failure_is_retried_then_succeeds() -> None:
    client = _FakeRedisClient(fail_times=2)
    store = _store(client)

    await store.save_session("sess-6", owner="owner-6")

    assert await store.get_session("sess-6") is not None


async def test_persistent_connection_failure_is_wrapped_not_raised_raw() -> None:
    client = _FakeRedisClient(fail=True)
    store = _store(client)

    with pytest.raises(SessionStoreError):
        await store.save_session("sess-7", owner="owner-7")

    with pytest.raises(SessionStoreError):
        await store.get_session("sess-7")

    with pytest.raises(SessionStoreError):
        await store.load_intake_progress("sess-7")
