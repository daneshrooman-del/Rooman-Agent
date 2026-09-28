"""FastAPI dependency providers."""

from __future__ import annotations

from functools import lru_cache

from sqlalchemy.engine import Engine

from trackb.config import get_settings
from trackb.contracts.avatar_client import AvatarServiceClient, StubAvatarServiceClient
from trackb.provisioning.store import get_engine


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
