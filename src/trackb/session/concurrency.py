"""Session-creation concurrency guard.

Tavus and HeyGen have both hit real production incidents from unbounded concurrent
session/avatar init: reports of 10-60s init latency under load, and at least one
capacity-driven outage (see `AI_Avatar_Agent_Platform_RnD_Plan.md` on `main`). This module is
Track B's guard against the same failure mode, applied around room-joins:

- A bounded semaphore caps how many joins can be in flight at once (`max_concurrent_sessions`)
  -- additional requests queue for a free slot rather than piling on unbounded, but only up to
  `acquire_timeout_seconds`, past which they fail fast with `SessionCapacityError` instead of
  queuing forever.
- Once a slot is acquired, the join itself is bounded by `join_timeout_seconds` -- a slow or
  hung join raises `SessionJoinTimeoutError` and releases its slot immediately, so it can never
  permanently starve the pool.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

import structlog

from trackb.config import Settings, get_settings
from trackb.session.errors import SessionCapacityError, SessionJoinTimeoutError

logger = structlog.get_logger(__name__)

T = TypeVar("T")


class SessionConcurrencyGuard:
    def __init__(
        self,
        *,
        settings: Settings | None = None,
        max_concurrent_sessions: int | None = None,
        join_timeout_seconds: float | None = None,
        acquire_timeout_seconds: float | None = None,
    ) -> None:
        settings = settings or get_settings()
        self.max_concurrent_sessions = (
            max_concurrent_sessions
            if max_concurrent_sessions is not None
            else settings.max_concurrent_sessions
        )
        self.join_timeout_seconds = (
            join_timeout_seconds
            if join_timeout_seconds is not None
            else settings.session_init_timeout_seconds
        )
        self.acquire_timeout_seconds = (
            acquire_timeout_seconds
            if acquire_timeout_seconds is not None
            else self.join_timeout_seconds
        )
        self._semaphore = asyncio.Semaphore(self.max_concurrent_sessions)
        self._active = 0

    @property
    def active_sessions(self) -> int:
        return self._active

    async def run(self, join_fn: Callable[[], Awaitable[T]], *, session_id: str) -> T:
        """Run `join_fn` under the concurrency + timeout guard.

        Raises `SessionCapacityError` if no slot frees up within `acquire_timeout_seconds`, or
        `SessionJoinTimeoutError` if `join_fn` itself doesn't finish within
        `join_timeout_seconds`. Either way, no slot is left held on failure.
        """
        try:
            await asyncio.wait_for(self._semaphore.acquire(), timeout=self.acquire_timeout_seconds)
        except asyncio.TimeoutError as exc:
            logger.warning(
                "session_capacity_exceeded",
                session_id=session_id,
                active_sessions=self._active,
                max_concurrent_sessions=self.max_concurrent_sessions,
            )
            raise SessionCapacityError(
                f"session {session_id!r} rejected: {self._active} session(s) already active "
                f"(limit {self.max_concurrent_sessions}) and no slot freed within "
                f"{self.acquire_timeout_seconds}s"
            ) from exc

        self._active += 1
        logger.info(
            "session_join_start", session_id=session_id, active_sessions=self._active
        )
        try:
            return await asyncio.wait_for(join_fn(), timeout=self.join_timeout_seconds)
        except asyncio.TimeoutError as exc:
            logger.error(
                "session_join_timeout",
                session_id=session_id,
                timeout_seconds=self.join_timeout_seconds,
            )
            raise SessionJoinTimeoutError(
                f"session {session_id!r} join did not complete within "
                f"{self.join_timeout_seconds}s"
            ) from exc
        finally:
            self._active -= 1
            self._semaphore.release()
