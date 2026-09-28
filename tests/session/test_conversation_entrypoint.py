from __future__ import annotations

from collections.abc import Callable

import pytest
from pydantic import BaseModel

from trackb.contracts.models import AgentSpec, FlowGraph, FlowState, FlowTransition
from trackb.llm.mock import MockLLMProvider
from trackb.session.conversation_entrypoint import (
    ConversationSessionDriver,
    _resolve_agent_id,
    _resolve_agent_spec,
    _resolve_session_id,
)
from trackb.session.flow_engine import FlowGraphDriver
from trackb.session.worker import TranscribedUtterance


class _FakeSessionWorker:
    def __init__(self) -> None:
        self.spoken: list[str] = []
        self.left = False

    async def speak(self, text: str) -> None:
        self.spoken.append(text)

    async def leave(self) -> None:
        self.left = True


def _hr_flow_graph() -> FlowGraph:
    return FlowGraph(
        entry_state="greet",
        states=[
            FlowState(
                name="greet",
                objective="Greet the candidate.",
                transitions=[FlowTransition(on="greeted", to_state="screen")],
            ),
            FlowState(
                name="screen",
                objective="Screen the candidate.",
                transitions=[FlowTransition(on="screened", to_state="schedule")],
            ),
            FlowState(
                name="schedule",
                objective="Schedule an interview.",
                transitions=[],
                is_terminal=True,
            ),
        ],
    )


def _agent_spec(agent_id: str = "agent-1") -> AgentSpec:
    return AgentSpec(
        agent_id=agent_id,
        owner="owner-1",
        purpose="take HR placement calls",
        persona_prompt="You are a helpful HR agent.",
        flow_graph=_hr_flow_graph(),
        avatar_id="avatar-1",
        voice_id="voice-1",
        created_from_session_id="session-1",
    )


def _extract_fn_sequence(
    responses: list[dict[str, object]],
) -> Callable[[str, type[BaseModel]], BaseModel]:
    calls = {"n": 0}

    def _extract(prompt: str, schema: type[BaseModel]) -> BaseModel:
        index = min(calls["n"], len(responses) - 1)
        calls["n"] += 1
        return schema.model_validate(responses[index])

    return _extract


@pytest.mark.asyncio
async def test_multi_turn_conversation_reaching_terminal_state_speaks_and_leaves_once() -> None:
    responses: list[dict[str, object]] = [
        {"response_text": "Hi, tell me about the role you're after.", "signal": "greeted"},
        {"response_text": "Great, let's screen you.", "signal": None},
        {"response_text": "Thanks, let's schedule your interview.", "signal": "screened"},
    ]
    llm = MockLLMProvider(extract_fn=_extract_fn_sequence(responses))
    flow_driver = FlowGraphDriver(_agent_spec(), llm)
    worker = _FakeSessionWorker()
    driver = ConversationSessionDriver(
        session_id="sess-1",
        agent_id="agent-1",
        flow_driver=flow_driver,
        session_worker=worker,
    )

    utterances = [
        "I'm calling about the backend role",
        "I have 5 years of experience",
        "That's everything",
    ]
    for text in utterances:
        await driver.on_utterance(
            TranscribedUtterance(session_id="sess-1", text=text, is_final=True)
        )

    assert worker.spoken == [
        "Hi, tell me about the role you're after.",
        "Great, let's screen you.",
        "Thanks, let's schedule your interview.",
    ]
    assert worker.left is True
    assert driver.completed is True

    # Further utterances after completion must not re-trigger speaking or leaving.
    await driver.on_utterance(
        TranscribedUtterance(session_id="sess-1", text="one more thing", is_final=True)
    )
    assert len(worker.spoken) == 3


@pytest.mark.asyncio
async def test_non_final_and_blank_utterances_are_ignored() -> None:
    llm = MockLLMProvider(
        extract_fn=lambda prompt, schema: schema.model_validate(
            {"response_text": "hi", "signal": None}
        )
    )
    flow_driver = FlowGraphDriver(_agent_spec(), llm)
    worker = _FakeSessionWorker()
    driver = ConversationSessionDriver(
        session_id="sess-2",
        agent_id="agent-1",
        flow_driver=flow_driver,
        session_worker=worker,
    )

    await driver.on_utterance(
        TranscribedUtterance(session_id="sess-2", text="interim", is_final=False)
    )
    await driver.on_utterance(TranscribedUtterance(session_id="sess-2", text="   ", is_final=True))

    assert worker.spoken == []
    assert worker.left is False


def test_resolve_agent_spec_returns_none_and_logs_when_agent_id_missing() -> None:
    calls: list[str] = []

    def _get_agent_spec(agent_id: str) -> AgentSpec | None:
        calls.append(agent_id)
        return _agent_spec(agent_id)

    result = _resolve_agent_spec(None, get_agent_spec_fn=_get_agent_spec)

    assert result is None
    assert calls == []  # never even looked up -- there was no agent_id to look up


def test_resolve_agent_spec_returns_none_when_spec_not_found() -> None:
    def _get_agent_spec(agent_id: str) -> AgentSpec | None:
        return None

    result = _resolve_agent_spec("agent-does-not-exist", get_agent_spec_fn=_get_agent_spec)

    assert result is None


def test_resolve_agent_spec_returns_spec_when_found() -> None:
    spec = _agent_spec("agent-1")

    result = _resolve_agent_spec("agent-1", get_agent_spec_fn=lambda agent_id: spec)

    assert result is spec


class _FakeJob:
    def __init__(self, id: str = "", metadata: str = "") -> None:  # noqa: A002
        self.id = id
        self.metadata = metadata


class _FakeRoom:
    def __init__(self, name: str = "", metadata: str = "") -> None:
        self.name = name
        self.metadata = metadata


class _FakeJobContext:
    def __init__(
        self,
        *,
        room_name: str = "",
        room_metadata: str = "",
        job_id: str = "",
        job_metadata: str = "",
    ) -> None:
        self.room = _FakeRoom(name=room_name, metadata=room_metadata)
        self.job = _FakeJob(id=job_id, metadata=job_metadata)


def test_resolve_agent_id_prefers_job_metadata() -> None:
    ctx = _FakeJobContext(job_metadata="agent-1", room_metadata="agent-fallback")

    assert _resolve_agent_id(ctx) == "agent-1"  # type: ignore[arg-type]


def test_resolve_agent_id_falls_back_to_room_metadata() -> None:
    ctx = _FakeJobContext(room_metadata="agent-fallback")

    assert _resolve_agent_id(ctx) == "agent-fallback"  # type: ignore[arg-type]


def test_resolve_agent_id_returns_none_when_nothing_available() -> None:
    ctx = _FakeJobContext()

    assert _resolve_agent_id(ctx) is None  # type: ignore[arg-type]


def test_resolve_session_id_prefers_room_name_over_job_id() -> None:
    ctx = _FakeJobContext(room_name="conversation-agent-1-sess-abc", job_id="livekit-job-xyz")

    assert _resolve_session_id(ctx, "agent-1") == "sess-abc"  # type: ignore[arg-type]


def test_resolve_session_id_falls_back_to_job_id_for_a_mismatched_room() -> None:
    ctx = _FakeJobContext(room_name="some-other-room", job_id="livekit-job-xyz")

    assert _resolve_session_id(ctx, "agent-1") == "livekit-job-xyz"  # type: ignore[arg-type]


def test_resolve_session_id_falls_back_to_random_uuid_when_nothing_available() -> None:
    import uuid

    ctx = _FakeJobContext()

    session_id = _resolve_session_id(ctx, "agent-1")  # type: ignore[arg-type]

    assert session_id
    uuid.UUID(session_id)
