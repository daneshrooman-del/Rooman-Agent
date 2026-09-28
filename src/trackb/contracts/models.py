from typing import Literal

from pydantic import BaseModel, Field

Channel = Literal["phone", "web", "api"]


def _default_channels() -> list[Channel]:
    return ["web"]


class FlowTransition(BaseModel):
    on: str = Field(
        description="The condition/signal that triggers this transition, "
        "e.g. 'slot_confirmed' or 'user_declines'"
    )
    to_state: str


class FlowState(BaseModel):
    name: str
    objective: str = Field(description="What this state must accomplish before it can exit")
    transitions: list[FlowTransition] = Field(default_factory=list)
    is_terminal: bool = False


class FlowGraph(BaseModel):
    entry_state: str
    states: list[FlowState]


class ToolBinding(BaseModel):
    name: str
    description: str
    endpoint: str | None = None


class AgentSpec(BaseModel):
    agent_id: str
    owner: str
    purpose: str
    persona_prompt: str
    flow_graph: FlowGraph
    knowledge_base_id: str | None = None
    tool_bindings: list[ToolBinding] = Field(default_factory=list)
    guardrails: list[str] = Field(default_factory=list)
    avatar_id: str
    voice_id: str
    languages: list[str] = Field(default_factory=lambda: ["en"])
    channels: list[Channel] = Field(default_factory=_default_channels)
    status: Literal["draft", "active", "disabled"] = "draft"
    created_from_session_id: str
