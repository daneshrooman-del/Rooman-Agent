"""Session metadata persistence for `POST /intake/start`.

Thin, FastAPI-route-facing wrapper around `trackb.session.redis_store.RedisSessionStore` --
kept as its own module so `api/routes.py` doesn't need to import `redis_store` directly and so
the public names `create_session`/`get_session` that `start_intake` already called stay stable.

This used to be a bare in-memory `dict[str, IntakeSessionRecord]` (see git history), explicitly
flagged as a placeholder for the Redis-backed, resumable store the `session/` track was
building. That store now exists (`RedisSessionStore`); this module just calls into it.
"""

from __future__ import annotations

from trackb.session.redis_store import RedisSessionStore, SessionRecord

IntakeSessionRecord = SessionRecord
"""Backward-compatible alias for the name this module used to export."""


async def create_session(
    store: RedisSessionStore,
    session_id: str,
    *,
    owner: str,
    avatar_id: str | None = None,
    voice_id: str | None = None,
) -> SessionRecord:
    return await store.save_session(
        session_id, owner=owner, avatar_id=avatar_id, voice_id=voice_id
    )


async def get_session(store: RedisSessionStore, session_id: str) -> SessionRecord | None:
    return await store.get_session(session_id)
