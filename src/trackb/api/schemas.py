"""Request/response models for the FastAPI routes.

These are API-layer wire formats, not the cross-track contract -- `AgentSpec`
(from `trackb.contracts`) is returned directly where the wire format matches
it 1:1 (`GET /agents`, `GET /agents/{agent_id}`).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class IntakeStartRequest(BaseModel):
    owner: str
    has_reference_video: bool = Field(
        default=False,
        description="Placeholder flag standing in for an actual uploaded reference "
        "video, until Track A's avatar upload flow exists. When true, a stub avatar "
        "is created for this session via the AvatarServiceClient dependency.",
    )


class IntakeStartResponse(BaseModel):
    session_id: str
    owner: str
    avatar_id: str | None = None
    status: Literal["started"] = "started"
    room_name: str
    livekit_url: str
    token: str


class ConversationStartResponse(BaseModel):
    session_id: str
    agent_id: str
    room_name: str
    livekit_url: str
    token: str
    status: Literal["pending"] = "pending"
