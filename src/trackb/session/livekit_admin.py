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
DEFAULT_CONVERSATION_AGENT_NAME = "trackb-conversation"
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


CONVERSATION_ROOM_NAME_PREFIX = "conversation-"


def conversation_room_name(agent_id: str, session_id: str) -> str:
    return f"{CONVERSATION_ROOM_NAME_PREFIX}{agent_id}-{session_id}"


def session_id_from_conversation_room_name(room_name: str, agent_id: str) -> str | None:
    """Inverse of `conversation_room_name`, given the `agent_id` already recovered from the
    dispatched job's metadata (see `create_conversation_room`'s docstring).

    Unlike `session_id_from_room_name`, this needs `agent_id` as an input rather than parsing
    it out of the room name too: both `agent_id` and `session_id` can themselves contain
    hyphens, so `f"{PREFIX}{agent_id}-{session_id}"` isn't unambiguously splittable from the
    room name alone. `agent_id` is always known first on the worker side (it comes from job
    metadata, resolved before the room name is ever consulted for `session_id`), so this simply
    strips the now-known `f"{PREFIX}{agent_id}-"` prefix. Returns `None` if `room_name` doesn't
    start with that exact prefix.
    """
    prefix = f"{CONVERSATION_ROOM_NAME_PREFIX}{agent_id}-"
    if not room_name.startswith(prefix):
        return None
    return room_name[len(prefix) :]


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

    async def create_conversation_room(
        self,
        agent_id: str,
        session_id: str,
        agent_name: str = DEFAULT_CONVERSATION_AGENT_NAME,
    ) -> api.Room:
        """Create (or return the existing) room for a deployed agent's live conversation.

        Mirrors `create_intake_room`, but the dispatched worker (`conversation_entrypoint`)
        needs to know *which* provisioned `AgentSpec` to run -- there's no such ambiguity
        during intake, where the worker always drives the same onboarding flow. `agent_id` is
        passed through two ways:

        - `RoomAgentDispatch(metadata=agent_id)`: confirmed against the installed
          `livekit-api`/`livekit-agents` (`agent_dispatch.pyi`) that a `RoomAgentDispatch`'s
          `metadata` field becomes the dispatched job's own `metadata` (`ctx.job.metadata` in
          the entrypoint, the same `agent.Job` proto `ctx.job.id`/`ctx.job.participant` are
          already read from elsewhere in this codebase) -- this is the primary channel, read
          first by `conversation_entrypoint._resolve_agent_id`.
        - `CreateRoomRequest(metadata=agent_id)` (room-level): a fallback, in case a worker
          ever needs to recover `agent_id` from `ctx.room.metadata` without a job metadata
          value available (e.g. a manually-created dispatch that didn't set one).

        Room names additionally encode `agent_id` (see `conversation_room_name`) purely for
        human-readable traceability in LiveKit's own room listing -- the worker never parses
        `agent_id` back out of the room name, only `session_id` (via
        `session_id_from_conversation_room_name`, once `agent_id` is already known from
        metadata).
        """
        room_name = conversation_room_name(agent_id, session_id)
        request = api.CreateRoomRequest(
            name=room_name,
            metadata=agent_id,
            agents=[api.RoomAgentDispatch(agent_name=agent_name, metadata=agent_id)],
        )

        room = await self._create_room(request)

        logger.info(
            "livekit_conversation_room_created",
            agent_id=agent_id,
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
