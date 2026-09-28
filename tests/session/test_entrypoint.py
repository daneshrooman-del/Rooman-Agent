import uuid
from collections.abc import Callable

import pytest
from pydantic import BaseModel

from trackb.contracts.models import AgentSpec, FlowGraph
from trackb.intake.graph import IntakeGraph
from trackb.llm.mock import MockLLMProvider
from trackb.provisioning.interfaces import AvatarAssignment, IntakeSessionResult
from trackb.session.entrypoint import (
    _UNKNOWN_OWNER,
    CLOSING_MESSAGE,
    IntakeSessionDriver,
    _resolve_owner,
    _resolve_session_id,
)
from trackb.session.worker import TranscribedUtterance


class _FakeSessionWorker:
    def __init__(self) -> None:
        self.spoken: list[str] = []
        self.left = False

    async def speak(self, text: str) -> None:
        self.spoken.append(text)

    async def leave(self) -> None:
        self.left = True


def _fake_agent_spec(session_id: str) -> AgentSpec:
    return AgentSpec(
        agent_id="agent-1",
        owner="owner-1",
        purpose="take HR placement calls",
        persona_prompt="You are a helpful agent.",
        flow_graph=FlowGraph(entry_state="start", states=[]),
        knowledge_base_id=None,
        tool_bindings=[],
        guardrails=[],
        avatar_id="avatar-1",
        voice_id="voice-1",
        languages=["en"],
        channels=["web"],
        status="draft",
        created_from_session_id=session_id,
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
async def test_follow_up_result_speaks_question_and_does_not_provision() -> None:
    llm = MockLLMProvider(
        extract_fn=lambda prompt, schema: schema.model_validate({"purpose": "screen candidates"})
    )
    graph = IntakeGraph(llm)
    worker = _FakeSessionWorker()
    provisioning_calls: list[tuple[IntakeSessionResult, AvatarAssignment]] = []

    async def fake_run_intake_session(
        intake_result: IntakeSessionResult, avatar_assignment: AvatarAssignment
    ) -> AgentSpec:
        provisioning_calls.append((intake_result, avatar_assignment))
        return _fake_agent_spec(intake_result.session_id)

    driver = IntakeSessionDriver(
        session_id="sess-1",
        owner="owner-1",
        intake_graph=graph,
        session_worker=worker,
        run_intake_session_fn=fake_run_intake_session,
    )

    await driver.on_utterance(
        TranscribedUtterance(session_id="sess-1", text="I want an HR agent", is_final=True)
    )

    assert len(worker.spoken) == 1
    assert worker.spoken[0] != CLOSING_MESSAGE
    assert provisioning_calls == []
    assert driver.completed is False
    assert worker.left is False


@pytest.mark.asyncio
async def test_non_final_and_blank_utterances_are_ignored() -> None:
    llm = MockLLMProvider(extract_fn=lambda prompt, schema: schema.model_validate({}))
    graph = IntakeGraph(llm)
    worker = _FakeSessionWorker()
    calls: list[str] = []

    async def fake_run_intake_session(
        intake_result: IntakeSessionResult, avatar_assignment: AvatarAssignment
    ) -> AgentSpec:
        calls.append("called")
        return _fake_agent_spec(intake_result.session_id)

    driver = IntakeSessionDriver(
        session_id="sess-2",
        owner="owner-2",
        intake_graph=graph,
        session_worker=worker,
        run_intake_session_fn=fake_run_intake_session,
    )

    await driver.on_utterance(
        TranscribedUtterance(session_id="sess-2", text="interim text", is_final=False)
    )
    await driver.on_utterance(TranscribedUtterance(session_id="sess-2", text="   ", is_final=True))

    assert worker.spoken == []
    assert calls == []


@pytest.mark.asyncio
async def test_multi_turn_conversation_reaching_completed_provisions_exactly_once() -> None:
    responses: list[dict[str, object]] = [
        {"purpose": "take HR placement calls"},
        {"caller_persona": "HR teams"},
        {"workflow_steps": ["confirm role", "screen candidate"]},
        {"languages": ["en"]},
    ]
    llm = MockLLMProvider(extract_fn=_extract_fn_sequence(responses))
    graph = IntakeGraph(llm)
    worker = _FakeSessionWorker()
    provisioning_calls: list[tuple[IntakeSessionResult, AvatarAssignment]] = []

    async def fake_run_intake_session(
        intake_result: IntakeSessionResult, avatar_assignment: AvatarAssignment
    ) -> AgentSpec:
        provisioning_calls.append((intake_result, avatar_assignment))
        return _fake_agent_spec(intake_result.session_id)

    avatar_assignment = AvatarAssignment(avatar_id="avatar-9", voice_id="voice-9")
    driver = IntakeSessionDriver(
        session_id="sess-3",
        owner="owner-3",
        intake_graph=graph,
        session_worker=worker,
        avatar_assignment=avatar_assignment,
        run_intake_session_fn=fake_run_intake_session,
    )

    utterances = [
        "I want an agent that takes HR placement calls",
        "HR teams will call it",
        "confirm role, then screen candidate",
        "just English",
    ]
    for text in utterances:
        await driver.on_utterance(
            TranscribedUtterance(session_id="sess-3", text=text, is_final=True)
        )

    assert len(provisioning_calls) == 1
    intake_result, passed_assignment = provisioning_calls[0]
    assert intake_result.session_id == "sess-3"
    assert intake_result.owner == "owner-3"
    assert intake_result.slots.purpose == "take HR placement calls"
    assert intake_result.slots.caller_persona == "HR teams"
    assert intake_result.slots.workflow_steps == ["confirm role", "screen candidate"]
    assert intake_result.slots.languages == ["en"]
    assert passed_assignment is avatar_assignment

    assert worker.spoken[-1] == CLOSING_MESSAGE
    assert worker.left is True
    assert driver.completed is True
    assert driver.provisioned_spec is not None

    # Further utterances after completion must not re-trigger provisioning or speaking.
    await driver.on_utterance(
        TranscribedUtterance(session_id="sess-3", text="one more thing", is_final=True)
    )
    assert len(provisioning_calls) == 1


class _FakeJob:
    def __init__(self, id: str = "", participant: object = None) -> None:  # noqa: A002
        self.id = id
        self.participant = participant


class _FakeParticipant:
    def __init__(self, identity: str) -> None:
        self.identity = identity


class _FakeJobContextForResolve:
    def __init__(
        self, *, room_name: str = "", job_id: str = "", participant: object = None
    ) -> None:
        self.room = _FakeRoomForResolve(room_name)
        self.job = _FakeJob(id=job_id, participant=participant)


class _FakeRoomForResolve:
    def __init__(self, name: str) -> None:
        self.name = name


def test_resolve_session_id_prefers_room_name_over_job_id() -> None:
    ctx = _FakeJobContextForResolve(room_name="intake-session-abc", job_id="livekit-job-xyz")

    assert _resolve_session_id(ctx) == "session-abc"  # type: ignore[arg-type]


def test_resolve_session_id_falls_back_to_job_id_for_a_non_intake_room() -> None:
    ctx = _FakeJobContextForResolve(room_name="some-other-room", job_id="livekit-job-xyz")

    assert _resolve_session_id(ctx) == "livekit-job-xyz"  # type: ignore[arg-type]


def test_resolve_session_id_falls_back_to_random_uuid_when_nothing_available() -> None:
    ctx = _FakeJobContextForResolve(room_name="", job_id="")

    session_id = _resolve_session_id(ctx)  # type: ignore[arg-type]

    assert session_id
    uuid.UUID(session_id)


def test_resolve_owner_reads_job_participant_identity() -> None:
    ctx = _FakeJobContextForResolve(participant=_FakeParticipant(identity="owner-42"))

    assert _resolve_owner(ctx) == "owner-42"  # type: ignore[arg-type]


def test_resolve_owner_falls_back_to_unknown_when_no_participant() -> None:
    ctx = _FakeJobContextForResolve()

    assert _resolve_owner(ctx) == _UNKNOWN_OWNER  # type: ignore[arg-type]
