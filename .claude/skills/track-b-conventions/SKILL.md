---
name: track-b-conventions
description: Architecture, tech stack, folder layout, API contracts, and production-readiness bar for the Track B (Live Conversation & Agent Builder) service. Load before writing, reviewing, or planning any code on the track-b-agent-builder branch.
---

# Track B — Live Conversation & Agent Builder

## What this service does
Turns a live voice/video conversation into a deployed, task-specific agent spec: real-time
session handling, requirement slot-filling, flow-graph generation, per-agent knowledge-base
ingestion, and provisioning. It is one of three independent tracks (A = avatar engine,
B = this one, C = platform/API/front-end) that combine only through the contracts below.

## Stack (locked in — do not swap without discussion)
- **Language**: Python 3.10+ (the dev machine has 3.10 installed; code should not rely on 3.11-only syntax)
- **Real-time transport**: LiveKit Agents SDK (self-hosted LiveKit server)
- **STT**: faster-whisper, self-hosted, streaming
- **LLM**: abstracted behind an `LLMProvider` protocol in `llm/` — never hardcode a specific
  vendor/model anywhere else in the codebase; the concrete LLM/hosting choice is being decided
  outside this track and will be wired in later as a config value
- **Orchestration**: LangGraph state graph for intake/slot-filling and flow generation
- **Vector DB**: Qdrant (self-hosted), one collection per generated agent's knowledge base
- **Persistence**: Postgres for agent specs/sessions; Redis for in-flight session state (so a
  dropped WebRTC connection can resume mid-intake instead of restarting)
- **API**: FastAPI

## Folder layout
```
src/trackb/
  config.py        # pydantic-settings, all config from env, no hardcoded secrets
  session/          # LiveKit agent worker: joins a room, wires audio in/out
  stt/              # faster-whisper wrapped to LiveKit's STT plugin interface
  llm/              # LLMProvider protocol + the swappable backend behind it
  intake/           # slot schema (Pydantic) + LangGraph state graph
  flowgen/          # turns filled slots into a FlowGraph (states/objectives/transitions)
  kb/                # chunk -> embed -> store in Qdrant, tied to agent_id
  provisioning/      # assembles + persists the final AgentSpec
  api/              # FastAPI routes: intake session lifecycle, conversation start, webhooks
  contracts/        # the shared Pydantic schemas below — the only files Track A/C should ever need to read
tests/
  contracts/        # schema + mocked-avatar-service compatibility tests — run via the contract-check skill
```

## The API contract — never change without updating Track A and Track C in the same PR

```python
class AgentSpec(BaseModel):
    agent_id: str
    owner: str
    purpose: str
    persona_prompt: str
    flow_graph: FlowGraph
    knowledge_base_id: str | None
    tool_bindings: list[ToolBinding]
    guardrails: list[str]
    avatar_id: str
    voice_id: str
    languages: list[str]
    channels: list[Literal["phone", "web", "api"]]
    status: Literal["draft", "active", "disabled"]
    created_from_session_id: str
```

Service entry points Track C's API layer calls:
```python
def run_intake_session() -> AgentSpec: ...
def run_conversation(agent_spec: AgentSpec) -> LiveSession: ...
```

Client interface this service calls into Track A's avatar engine (build/test against a stub
of this until Track A's real service exists — never block on it):
```python
def create_avatar(video_file: bytes) -> str: ...  # -> avatar_id
def generate(avatar_id: str, script_or_audio: str | bytes, action_type: str) -> bytes | AsyncIterator[bytes]: ...
```

## Production bar for every change
- Every new module ships with tests (pytest) in the same commit — slot-filling logic, flow
  generation, and the `AgentSpec` schema all need unit tests; nothing merges without them.
- Type hints everywhere; `ruff` and `mypy` clean before commit.
- No hardcoded secrets or endpoints — config via `pydantic-settings` + `.env`, never in code.
- Every external call (STT, LLM, embedding, Qdrant, Track A's avatar service) is wrapped with
  an explicit timeout and a retry (`tenacity`) — never a bare call with no failure handling.
- Structured logging (one line per session-lifecycle event: `session_start`, `slot_filled`,
  `flow_generated`, `agent_provisioned`, `session_end`) — this is how production issues get
  debugged, not print statements.
- Guard session-creation concurrency deliberately: both Tavus and HeyGen hit real production
  incidents from exactly this (10-60s init latency reports, a capacity-driven outage) — rate-
  limit and queue session creation under load rather than let it fall over. See
  `AI_Avatar_Agent_Platform_RnD_Plan.md` on `main` for the sourced detail.
- Default to writing no comments; code should read from names and types. Only comment a
  genuinely non-obvious constraint (e.g. why a retry budget is what it is).

## Definition of done for a feature
1. `pytest` passes, `ruff`/`mypy` clean.
2. If it touches `AgentSpec` or either service interface above, this file is updated in the
   same commit, and the contract tests in `tests/contracts/` are updated to match.
3. Structured log lines exist for any new session-lifecycle event.
