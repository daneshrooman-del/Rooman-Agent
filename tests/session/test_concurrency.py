import asyncio

import pytest

from trackb.session.concurrency import SessionConcurrencyGuard
from trackb.session.errors import SessionCapacityError, SessionJoinTimeoutError


@pytest.mark.asyncio
async def test_successful_join_returns_join_fn_result() -> None:
    guard = SessionConcurrencyGuard(
        max_concurrent_sessions=2, join_timeout_seconds=1.0, acquire_timeout_seconds=1.0
    )

    async def join_fn() -> str:
        return "joined"

    result = await guard.run(join_fn, session_id="s1")

    assert result == "joined"
    assert guard.active_sessions == 0


@pytest.mark.asyncio
async def test_never_exceeds_max_concurrent_sessions() -> None:
    guard = SessionConcurrencyGuard(
        max_concurrent_sessions=2, join_timeout_seconds=5.0, acquire_timeout_seconds=5.0
    )
    concurrent = 0
    max_observed = 0

    async def slow_join() -> None:
        nonlocal concurrent, max_observed
        concurrent += 1
        max_observed = max(max_observed, concurrent)
        await asyncio.sleep(0.1)
        concurrent -= 1

    await asyncio.gather(
        *(guard.run(slow_join, session_id=f"s{i}") for i in range(6))
    )

    assert max_observed <= 2
    assert guard.active_sessions == 0


@pytest.mark.asyncio
async def test_hung_join_times_out_and_releases_its_slot() -> None:
    guard = SessionConcurrencyGuard(
        max_concurrent_sessions=1, join_timeout_seconds=0.05, acquire_timeout_seconds=1.0
    )

    async def hung_join() -> None:
        await asyncio.sleep(5.0)

    with pytest.raises(SessionJoinTimeoutError):
        await guard.run(hung_join, session_id="hung")

    assert guard.active_sessions == 0

    async def fast_join() -> str:
        return "ok"

    result = await guard.run(fast_join, session_id="after-hung")
    assert result == "ok"


@pytest.mark.asyncio
async def test_capacity_exceeded_raises_instead_of_queuing_forever() -> None:
    guard = SessionConcurrencyGuard(
        max_concurrent_sessions=1, join_timeout_seconds=1.0, acquire_timeout_seconds=0.05
    )
    holding_slot = asyncio.Event()

    async def hold_slot() -> None:
        holding_slot.set()
        await asyncio.sleep(0.5)

    holder_task = asyncio.create_task(guard.run(hold_slot, session_id="holder"))
    await holding_slot.wait()

    async def rejected_join() -> None:
        raise AssertionError("should never run: capacity was full")

    with pytest.raises(SessionCapacityError):
        await guard.run(rejected_join, session_id="rejected")

    await holder_task


@pytest.mark.asyncio
async def test_join_fn_exception_still_releases_slot() -> None:
    guard = SessionConcurrencyGuard(
        max_concurrent_sessions=1, join_timeout_seconds=1.0, acquire_timeout_seconds=1.0
    )

    async def failing_join() -> None:
        raise RuntimeError("boom")

    with pytest.raises(RuntimeError, match="boom"):
        await guard.run(failing_join, session_id="failing")

    assert guard.active_sessions == 0


@pytest.mark.asyncio
async def test_defaults_come_from_settings_when_not_overridden() -> None:
    from trackb.config import Settings

    settings = Settings(max_concurrent_sessions=3, session_init_timeout_seconds=7.0)
    guard = SessionConcurrencyGuard(settings=settings)

    assert guard.max_concurrent_sessions == 3
    assert guard.join_timeout_seconds == 7.0
    assert guard.acquire_timeout_seconds == 7.0
