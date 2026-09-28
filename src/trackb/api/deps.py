"""FastAPI dependency providers."""

from __future__ import annotations

import asyncio
from functools import lru_cache

from sqlalchemy.engine import Engine

from trackb.config import get_settings
from trackb.contracts.avatar_client import AvatarServiceClient, StubAvatarServiceClient
from trackb.provisioning.store import get_engine
from trackb.session.livekit_admin import LiveKitAdmin


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
    """
    global _livekit_admin
    if _livekit_admin is None:
        async with _livekit_admin_lock:
            if _livekit_admin is None:
                _livekit_admin = LiveKitAdmin()
    return _livekit_admin
