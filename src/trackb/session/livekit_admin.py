"""Admin-side LiveKit integration: create a room with an agent dispatch attached, and mint
join tokens for a human participant to connect to it.

This is the "server API" half of a LiveKit session -- distinct from `session/room_client.py`'s
`RoomClient` Protocol, which models the worker-side connection the dispatched agent job itself
uses once it's running inside `entrypoint(ctx)`. This module is what `POST /intake/start` (and
`POST /agents/{agent_id}/conversation/start`) call to actually bring a room into existence and
tell LiveKit which agent job to dispatch into it.

Confirmed against the installed `livekit-api` (bundled in `livekit-agents`, 1.8.3-era) by
inspecting `livekit.api` directly rather than guessing:
- `api.LiveKitAPI(url, api_key, api_secret, timeout=aiohttp.ClientTimeout(...))` is the async
  server-API client. It exposes `.room` (`RoomService`) and `.agent_dispatch`
  (`AgentDispatchService`) sub-clients and must be closed via `await client.aclose()`.
- `api.CreateRoomRequest(name=..., agents=[api.RoomAgentDispatch(agent_name=...)])` is the
  current/preferred way to attach an agent dispatch to a room: the dispatch is embedded in room
  creation itself (`RoomService.create_room`), rather than a separate
  `AgentDispatchService.create_dispatch` call issued after the room already exists. We use the
  embedded form -- one round trip instead of two, and the room never exists without its
  dispatch already configured.
- `api.AccessToken(api_key, api_secret)` with `.with_identity(...)`, `.with_grants(...)` (given
  an `api.VideoGrants(room_join=True, room=...)`), and `.to_jwt()` mints the JWT a human
  participant uses to join. `AccessToken`/`VideoGrants`/`to_jwt()` do no network I/O -- the JWT
  is signed locally -- so `mint_join_token` gets error handling but no timeout/retry: there is
  nothing that can hang or transiently fail, only calling code passing a bad argument (e.g.
  `room_join=True` with no identity, which `to_jwt()` itself rejects).
"""

from __future__ import annotations

import asyncio
import datetime

import aiohttp
import structlog
from livekit import api
from tenacity import retry, stop_after_attempt, wait_exponential

from trackb.config import Settings, get_settings

logger = structlog.get_logger(__name__)

DEFAULT_AGENT_NAME = "trackb-intake"
LIVEKIT_API_TIMEOUT_SECONDS = 10.0
JOIN_TOKEN_TTL_SECONDS = 60 * 60  # 1 hour -- generous enough to cover a full intake session

_RETRY = retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=4),
    reraise=True,
)


class LiveKitAdminError(Exception):
    """Raised when creating a room/dispatch, or minting a join token, fails."""


ROOM_NAME_PREFIX = "intake-"


def room_name_for_session(session_id: str) -> str:
    return f"{ROOM_NAME_PREFIX}{session_id}"


def session_id_from_room_name(room_name: str) -> str | None:
    """Inverse of `room_name_for_session`.

    Used on the worker side (`session/entrypoint.py`) to recover the API-issued
    `session_id` from `ctx.room.name` -- the room name is the correlation key
    `POST /intake/start` actually created, unlike LiveKit's own internal job id,
    which is a different identifier space entirely. Returns `None` for a room
    name this module didn't mint (e.g. a conversation room from a different
    flow), so callers can fall back appropriately instead of returning a
    silently wrong session_id.
    """
    if not room_name.startswith(ROOM_NAME_PREFIX):
        return None
    return room_name[len(ROOM_NAME_PREFIX) :]


class LiveKitAdmin:
    """Wraps `livekit.api.LiveKitAPI` to create dispatch-configured rooms and join tokens."""

    def __init__(
        self,
        settings: Settings | None = None,
        client: api.LiveKitAPI | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._client = client or api.LiveKitAPI(
            url=self._settings.livekit_url,
            api_key=self._settings.livekit_api_key,
            api_secret=self._settings.livekit_api_secret,
            timeout=aiohttp.ClientTimeout(total=LIVEKIT_API_TIMEOUT_SECONDS),
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> LiveKitAdmin:
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.aclose()

    async def create_intake_room(
        self, session_id: str, agent_name: str = DEFAULT_AGENT_NAME
    ) -> api.Room:
        """Create (or return the existing) room for `session_id`, dispatching `agent_name` into it.

        `RoomService.create_room` is idempotent on room name -- calling it again for a room
        that already exists just returns the existing room, so this is safe to call more than
        once for the same `session_id`.
        """
        room_name = room_name_for_session(session_id)
        request = api.CreateRoomRequest(
            name=room_name,
            agents=[api.RoomAgentDispatch(agent_name=agent_name)],
        )

        room = await self._create_room(request)

        logger.info(
            "livekit_room_created",
            session_id=session_id,
            room_name=room.name,
            room_sid=room.sid,
            agent_name=agent_name,
        )
        return room

    @_RETRY
    async def _create_room(self, request: api.CreateRoomRequest) -> api.Room:
        try:
            return await asyncio.wait_for(
                self._client.room.create_room(request), timeout=LIVEKIT_API_TIMEOUT_SECONDS
            )
        except Exception as exc:
            logger.warning(
                "livekit_room_create_attempt_failed", room_name=request.name, error=str(exc)
            )
            raise LiveKitAdminError(
                f"failed to create room {request.name!r}: {exc}"
            ) from exc

    async def mint_join_token(
        self, room_name: str, identity: str, *, name: str | None = None
    ) -> str:
        """Mint a JWT for `identity` to join `room_name` as a full participant."""
        try:
            token = (
                api.AccessToken(self._settings.livekit_api_key, self._settings.livekit_api_secret)
                .with_identity(identity)
                .with_name(name or identity)
                .with_grants(api.VideoGrants(room_join=True, room=room_name))
                .with_ttl(datetime.timedelta(seconds=JOIN_TOKEN_TTL_SECONDS))
            )
            jwt = token.to_jwt()
        except Exception as exc:
            logger.error(
                "livekit_token_mint_failed", room_name=room_name, identity=identity, error=str(exc)
            )
            raise LiveKitAdminError(
                f"failed to mint join token for room {room_name!r}, identity {identity!r}: {exc}"
            ) from exc

        logger.info("livekit_token_minted", room_name=room_name, identity=identity)
        return jwt
