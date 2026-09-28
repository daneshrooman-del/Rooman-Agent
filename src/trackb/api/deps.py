"""FastAPI dependency providers."""

from __future__ import annotations

import asyncio
from functools import lru_cache

import structlog
from fastapi import HTTPException
from sqlalchemy.engine import Engine

from trackb.config import get_settings
from trackb.contracts.avatar_client import AvatarServiceClient, StubAvatarServiceClient
from trackb.provisioning.store import get_engine
from trackb.session.livekit_admin import LiveKitAdmin

log = structlog.get_logger(__name__)


@lru_cache(maxsize=1)
def get_avatar_client() -> AvatarServiceClient:
    """Default avatar-service dependency.

    Wired to the in-memory `StubAvatarServiceClient` for now. Track A's real
    client swaps in here later (e.g. behind a config flag / a factory keyed
    off `Settings.avatar_service_url`) -- this stub is not meant to be
    permanent.
    """
    return StubAvatarServiceClient()


def get_db_engine() -> Engine:
    settings = get_settings()
    return get_engine(settings.database_url)


_livekit_admin: LiveKitAdmin | None = None
_livekit_admin_lock = asyncio.Lock()


async def get_livekit_admin() -> LiveKitAdmin:
    """Default LiveKit admin-API dependency, lazily constructed as a process-wide singleton.

    Unlike `get_avatar_client`/`get_db_engine`, this can't be a plain `@lru_cache`-wrapped sync
    function: `LiveKitAdmin` constructs an `aiohttp.ClientSession` under the hood, and FastAPI
    runs sync dependencies in a threadpool -- off the request's event loop -- which makes
    `aiohttp.ClientSession()` raise `RuntimeError: no running event loop`. Being `async def`
    keeps construction on the event loop that will actually use it.

    Construction itself can fail (e.g. `livekit.api.LiveKitAPI.__init__` raises a raw
    `ValueError` if `Settings.livekit_api_key`/`livekit_api_secret` aren't configured) --
    caught here and turned into a clean 503 raised from the dependency, since a route's own
    try/except around `LiveKitAdmin` *method calls* never runs for a failure that happens
    while FastAPI is still resolving dependencies, before the route body executes.
    """
    global _livekit_admin
    if _livekit_admin is None:
        async with _livekit_admin_lock:
            if _livekit_admin is None:
                try:
                    _livekit_admin = LiveKitAdmin()
                except Exception as exc:
                    log.error("livekit_admin_construction_failed", error=str(exc))
                    raise HTTPException(
                        status_code=503,
                        detail="LiveKit is not configured (set TRACKB_LIVEKIT_API_KEY / "
                        "TRACKB_LIVEKIT_API_SECRET / TRACKB_LIVEKIT_URL)",
                    ) from exc
    return _livekit_admin
