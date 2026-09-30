"""Request/response models for the FastAPI routes.

These are API-layer wire formats, not the cross-track contract -- `AgentSpec`
(from `trackb.contracts`) is returned directly where the wire format matches
it 1:1 (`GET /agents`, `GET /agents/{agent_id}`).
"""

from __future__ import annotations

from typing import Any, Literal

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


class ReferenceDocumentUploadResponse(BaseModel):
    session_id: str
    filename: str
    characters_extracted: int
    documents_count: int


class ConversationStartResponse(BaseModel):
    session_id: str
    agent_id: str
    room_name: str
    livekit_url: str
    token: str
    status: Literal["pending"] = "pending"


class FrontendAgentTool(BaseModel):
    """One `AgentSpec.tool_bindings` entry, translated for the frontend `AgentTool` type."""

    id: str
    name: str
    description: str
    enabled: Literal[True] = True


class FrontendWorkflowNode(BaseModel):
    """One `AgentSpec.flow_graph` state, translated for the frontend `WorkflowNode` type."""

    id: str
    label: str
    kind: Literal["start", "step", "end", "decision", "tool", "handoff"]
    description: str


class FrontendAgentStats(BaseModel):
    """Always zeros -- this project has no usage-tracking yet (known gap, see
    `FrontendAgent`'s docstring)."""

    conversations: int = 0
    completionRate: int = 0
    activeToday: int = 0
    avgDurationSec: int = 0


class FrontendAgent(BaseModel):
    """`AgentSpec` translated into the frontend's `Agent` TypeScript type (`src/types.ts` at the
    repo root, a different tree owned by the frontend track). Field mapping, including the
    best-effort ones `AgentSpec` has no direct equivalent for:

    - `name`: synthesized from the first 40 characters of `purpose` (no title-casing).
    - `status`: `"draft"->"draft"`, `"active"->"live"`, `"disabled"->"paused"`. Nothing in
      `AgentSpec.status` maps to `"deploying"`.
    - `caller`: left as an empty string -- `AgentSpec` has no dedicated caller-persona field and
      no clean derivation exists; a known gap.
    - `goals`: one entry per non-terminal `flow_graph` state's `objective`.
    - `personality`: `persona_prompt` verbatim.
    - `tools`: one per `tool_bindings` entry, `id` = its `name` (no separate tool id exists).
    - `knowledge` / `activity`: always `[]` -- no knowledge-source-detail or activity-log model
      exists yet; known gaps.
    - `stats`: always zeros -- no usage-tracking exists yet; a known gap.
    - `createdAt` / `updatedAt`: both set to the persisted row's real `created_at` (see
      `provisioning.store.get_agent_spec_with_created_at`) -- there is no separate
      update-tracking, so the two are always equal.
    """

    id: str
    name: str
    status: Literal["live", "paused", "draft", "deploying"]
    avatarId: str
    voiceId: str
    purpose: str
    caller: str
    goals: list[str]
    personality: str
    guardrails: list[str]
    languages: list[str]
    channels: list[Literal["phone", "web", "api", "video", "whatsapp"]]
    tools: list[FrontendAgentTool]
    knowledge: list[Any] = Field(default_factory=list)
    workflow: list[FrontendWorkflowNode]
    stats: FrontendAgentStats
    createdAt: str
    updatedAt: str
    activity: list[Any] = Field(default_factory=list)
