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

import io
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import structlog
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pypdf import PdfReader
from sqlalchemy.engine import Engine

from trackb.api.conversation import run_conversation
from trackb.api.deps import get_avatar_client, get_db_engine, get_livekit_admin, get_session_store
from trackb.api.schemas import (
    ConversationStartResponse,
    FrontendAgent,
    FrontendAgentStats,
    FrontendAgentTool,
    FrontendWorkflowNode,
    IntakeStartRequest,
    IntakeStartResponse,
    ReferenceDocumentUploadResponse,
)
from trackb.api.sessions import create_session
from trackb.config import get_settings
from trackb.contracts.avatar_client import AvatarServiceClient
from trackb.contracts.models import AgentSpec, FlowGraph, FlowState
from trackb.provisioning.store import (
    get_agent_spec,
    get_agent_spec_with_created_at,
    list_agent_specs,
    list_agent_specs_with_created_at,
)
from trackb.session.livekit_admin import LiveKitAdmin, LiveKitAdminError
from trackb.session.redis_store import RedisSessionStore

log = structlog.get_logger(__name__)

router = APIRouter()

DEFAULT_VOICE_ID = "voice-default"

_PDF_EXTENSION = ".pdf"
_PDF_CONTENT_TYPE = "application/pdf"
_TEXT_EXTENSIONS = {".txt", ".text", ".md"}
_SUPPORTED_TYPES_MESSAGE = "supported file types: .txt, .md, .pdf"


@router.post("/intake/start", response_model=IntakeStartResponse)
async def start_intake(
    request: IntakeStartRequest,
    avatar_client: AvatarServiceClient = Depends(get_avatar_client),  # noqa: B008
    livekit_admin: LiveKitAdmin = Depends(get_livekit_admin),  # noqa: B008
    session_store: RedisSessionStore = Depends(get_session_store),  # noqa: B008
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

    await create_session(
        session_store,
        session_id,
        owner=request.owner,
        avatar_id=avatar_id,
        voice_id=DEFAULT_VOICE_ID,
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


def _extract_pdf_text(raw_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(raw_bytes))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as exc:
        raise HTTPException(
            status_code=422, detail=f"could not extract text from PDF: {exc}"
        ) from exc


def _extract_document_text(filename: str, content_type: str, raw_bytes: bytes) -> str:
    suffix = Path(filename).suffix.lower()

    if suffix == _PDF_EXTENSION or content_type == _PDF_CONTENT_TYPE:
        text = _extract_pdf_text(raw_bytes)
    elif suffix in _TEXT_EXTENSIONS or content_type.startswith("text/"):
        try:
            text = raw_bytes.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise HTTPException(
                status_code=415, detail=f"uploaded file is not valid UTF-8 text: {exc}"
            ) from exc
    else:
        raise HTTPException(
            status_code=415,
            detail=f"unsupported file type ({suffix or content_type or 'unknown'}); "
            f"{_SUPPORTED_TYPES_MESSAGE}",
        )

    if not text.strip():
        raise HTTPException(
            status_code=422, detail="uploaded file contained no extractable text"
        )
    return text


@router.post(
    "/intake/{session_id}/documents", response_model=ReferenceDocumentUploadResponse
)
async def upload_reference_document(
    session_id: str,
    file: UploadFile = File(...),  # noqa: B008
    session_store: RedisSessionStore = Depends(get_session_store),  # noqa: B008
) -> ReferenceDocumentUploadResponse:
    session = await session_store.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"session not found: {session_id}")

    raw_bytes = await file.read()
    text = _extract_document_text(file.filename or "", file.content_type or "", raw_bytes)

    await session_store.add_reference_document(session_id, text)
    documents = await session_store.get_reference_documents(session_id)

    log.info(
        "reference_document_uploaded",
        session_id=session_id,
        filename=file.filename,
        characters_extracted=len(text),
        documents_count=len(documents),
    )

    return ReferenceDocumentUploadResponse(
        session_id=session_id,
        filename=file.filename or "",
        characters_extracted=len(text),
        documents_count=len(documents),
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


async def _existing_agent_spec(
    agent_id: str, engine: Engine = Depends(get_db_engine)  # noqa: B008
) -> AgentSpec:
    """404s on a missing agent, as its own dependency rather than a check in the route body.

    FastAPI resolves a route's `Depends` params in declaration order and stops at the first one
    that raises -- a route body's own checks never run until *every* declared dependency has
    already resolved successfully. `start_conversation` also depends on `get_livekit_admin`,
    which raises a 503 (see its docstring) whenever LiveKit isn't configured; if this 404 check
    stayed in the route body, a request for a nonexistent agent_id against an unconfigured
    LiveKit would surface as a misleading 503 instead of 404 -- LiveKit's own dependency would
    already have raised before the body's agent lookup ever ran. Declaring this as its own
    `Depends`, ahead of `get_livekit_admin` in `start_conversation`'s signature, ensures the 404
    is what a caller actually sees for a missing agent, regardless of LiveKit configuration.
    """
    spec = get_agent_spec(agent_id, engine=engine)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"agent not found: {agent_id}")
    return spec


_FRONTEND_STATUS_MAP: dict[str, Literal["live", "paused", "draft"]] = {
    "draft": "draft",
    "active": "live",
    "disabled": "paused",
}
_FRONTEND_NAME_MAX_LENGTH = 40


def _synthesize_frontend_name(purpose: str) -> str:
    name = purpose.strip()[:_FRONTEND_NAME_MAX_LENGTH].strip()
    return name or "Unnamed agent"


def _frontend_workflow_kind(
    state: FlowState, flow_graph: FlowGraph
) -> Literal["start", "step", "end", "decision", "tool", "handoff"]:
    """`"start"` takes priority over `"end"` for a (degenerate) single-state graph whose only
    state is both the entry state and terminal."""
    if state.name == flow_graph.entry_state:
        return "start"
    if state.is_terminal:
        return "end"
    return "step"


def _created_at_iso(created_at: datetime) -> str:
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return created_at.isoformat()


def _to_frontend_agent(spec: AgentSpec, created_at: datetime) -> FrontendAgent:
    """Translate a persisted `AgentSpec` into the frontend's `Agent` wire shape -- see
    `FrontendAgent`'s docstring (`api/schemas.py`) for the field-mapping decisions, especially
    the best-effort ones (`name`, `caller`, `goals`, `personality`) `AgentSpec` has no direct
    equivalent for."""
    created_iso = _created_at_iso(created_at)
    return FrontendAgent(
        id=spec.agent_id,
        name=_synthesize_frontend_name(spec.purpose),
        status=_FRONTEND_STATUS_MAP[spec.status],
        avatarId=spec.avatar_id,
        voiceId=spec.voice_id,
        purpose=spec.purpose,
        caller="",
        goals=[state.objective for state in spec.flow_graph.states if not state.is_terminal],
        personality=spec.persona_prompt,
        guardrails=list(spec.guardrails),
        languages=list(spec.languages),
        channels=list(spec.channels),
        tools=[
            FrontendAgentTool(id=binding.name, name=binding.name, description=binding.description)
            for binding in spec.tool_bindings
        ],
        workflow=[
            FrontendWorkflowNode(
                id=state.name,
                label=state.name,
                kind=_frontend_workflow_kind(state, spec.flow_graph),
                description=state.objective,
            )
            for state in spec.flow_graph.states
        ],
        stats=FrontendAgentStats(),
        createdAt=created_iso,
        updatedAt=created_iso,
    )


@router.get("/frontend/agents/{agent_id}", response_model=FrontendAgent)
async def get_frontend_agent(
    agent_id: str, engine: Engine = Depends(get_db_engine)  # noqa: B008
) -> FrontendAgent:
    result = get_agent_spec_with_created_at(agent_id, engine=engine)
    if result is None:
        raise HTTPException(status_code=404, detail=f"agent not found: {agent_id}")
    spec, created_at = result
    return _to_frontend_agent(spec, created_at)


@router.get("/frontend/agents", response_model=list[FrontendAgent])
async def list_frontend_agents(
    engine: Engine = Depends(get_db_engine),  # noqa: B008
) -> list[FrontendAgent]:
    return [
        _to_frontend_agent(spec, created_at)
        for spec, created_at in list_agent_specs_with_created_at(engine=engine)
    ]


@router.post(
    "/agents/{agent_id}/conversation/start", response_model=ConversationStartResponse
)
async def start_conversation(
    agent_id: str,
    spec: AgentSpec = Depends(_existing_agent_spec),  # noqa: B008
    livekit_admin: LiveKitAdmin = Depends(get_livekit_admin),  # noqa: B008
) -> ConversationStartResponse:
    try:
        live_session = await run_conversation(spec, livekit_admin)
    except LiveKitAdminError as exc:
        log.error("session_start_failed", agent_id=agent_id, error=str(exc))
        raise HTTPException(
            status_code=503, detail=f"failed to provision LiveKit room: {exc}"
        ) from exc

    log.info(
        "session_start",
        agent_id=agent_id,
        session_id=live_session.session_id,
        room_name=live_session.room_name,
    )

    return ConversationStartResponse(
        session_id=live_session.session_id,
        agent_id=agent_id,
        room_name=live_session.room_name,
        livekit_url=live_session.livekit_url,
        token=live_session.token,
        status=live_session.status,
    )
