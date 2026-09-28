"""FastAPI routes: intake session lifecycle, agent lookup, conversation start.

Assumption on `POST /intake/start`: the actual turn-by-turn slot-filling
conversation happens live, over a LiveKit room that the `session/` track
wires up -- it is not a request/response exchange this endpoint can drive
synchronously. So this endpoint only mints a session_id (and, if a reference
video was supplied, a stub avatar_id via the AvatarServiceClient dependency)
and hands it back; the caller is expected to join the corresponding LiveKit
room out-of-band using that session_id. Once `trackb.intake.graph` and
`trackb.session` exist, this is where they get wired together (e.g. kicking
off the room + `IntakeGraph` here, or via a webhook once the session ends
calling `provisioning.run_intake_session`).
"""

from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.engine import Engine

from trackb.api.conversation import run_conversation
from trackb.api.deps import get_avatar_client, get_db_engine, get_livekit_admin
from trackb.api.schemas import ConversationStartResponse, IntakeStartRequest, IntakeStartResponse
from trackb.api.sessions import create_session
from trackb.config import get_settings
from trackb.contracts.avatar_client import AvatarServiceClient
from trackb.contracts.models import AgentSpec
from trackb.provisioning.store import get_agent_spec, list_agent_specs
from trackb.session.livekit_admin import LiveKitAdmin, LiveKitAdminError

log = structlog.get_logger(__name__)

router = APIRouter()

DEFAULT_VOICE_ID = "voice-default"


@router.post("/intake/start", response_model=IntakeStartResponse)
async def start_intake(
    request: IntakeStartRequest,
    avatar_client: AvatarServiceClient = Depends(get_avatar_client),  # noqa: B008
    livekit_admin: LiveKitAdmin = Depends(get_livekit_admin),  # noqa: B008
) -> IntakeStartResponse:
    session_id = str(uuid.uuid4())

    avatar_id: str | None = None
    if request.has_reference_video:
        avatar_id = await avatar_client.create_avatar(b"placeholder-reference-video")

    try:
        room = await livekit_admin.create_intake_room(session_id)
        token = await livekit_admin.mint_join_token(room.name, identity=request.owner)
    except LiveKitAdminError as exc:
        log.error(
            "session_start_failed", session_id=session_id, owner=request.owner, error=str(exc)
        )
        raise HTTPException(
            status_code=503, detail=f"failed to provision LiveKit room: {exc}"
        ) from exc

    create_session(
        session_id, owner=request.owner, avatar_id=avatar_id, voice_id=DEFAULT_VOICE_ID
    )
    log.info("session_start", session_id=session_id, owner=request.owner, room_name=room.name)

    return IntakeStartResponse(
        session_id=session_id,
        owner=request.owner,
        avatar_id=avatar_id,
        room_name=room.name,
        livekit_url=get_settings().livekit_url,
        token=token,
    )


@router.get("/agents/{agent_id}", response_model=AgentSpec)
async def get_agent(agent_id: str, engine: Engine = Depends(get_db_engine)) -> AgentSpec:  # noqa: B008
    spec = get_agent_spec(agent_id, engine=engine)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"agent not found: {agent_id}")
    return spec


@router.get("/agents", response_model=list[AgentSpec])
async def list_agents(engine: Engine = Depends(get_db_engine)) -> list[AgentSpec]:  # noqa: B008
    return list_agent_specs(engine=engine)


@router.post(
    "/agents/{agent_id}/conversation/start", response_model=ConversationStartResponse
)
async def start_conversation(
    agent_id: str, engine: Engine = Depends(get_db_engine)  # noqa: B008
) -> ConversationStartResponse:
    spec = get_agent_spec(agent_id, engine=engine)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"agent not found: {agent_id}")

    live_session = run_conversation(spec)
    log.info("session_start", agent_id=agent_id, session_id=live_session.session_id)

    return ConversationStartResponse(
        session_id=live_session.session_id,
        agent_id=agent_id,
        room_name=live_session.room_name,
        status=live_session.status,
    )
