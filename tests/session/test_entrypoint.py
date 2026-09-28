import uuid
from collections.abc import Callable

import pytest
from pydantic import BaseModel

from trackb.contracts.models import AgentSpec, FlowGraph
from trackb.intake.graph import IntakeGraph
from trackb.intake.schema import IntakeSlots
from trackb.llm.mock import MockLLMProvider
from trackb.provisioning.interfaces import AvatarAssignment, IntakeSessionResult
from trackb.session.entrypoint import (
    _UNKNOWN_OWNER,
    CLOSING_MESSAGE,
    IntakeSessionDriver,
    _load_or_create_intake_graph,
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


class _FakeIntakeProgressStore:
    """Stands in for `RedisSessionStore`'s intake-progress slice."""

    def __init__(self, existing: dict[str, tuple[IntakeSlots, list[str]]] | None = None) -> None:
        self._progress = dict(existing or {})
        self.saved_calls: list[tuple[str, IntakeSlots, list[str]]] = []
        self.cleared: list[str] = []

    async def load_intake_progress(self, session_id: str) -> tuple[IntakeSlots, list[str]] | None:
        return self._progress.get(session_id)

    async def save_intake_progress(
        self, session_id: str, slots: IntakeSlots, history: list[str]
    ) -> None:
        self._progress[session_id] = (slots, list(history))
        self.saved_calls.append((session_id, slots, list(history)))

    async def clear_intake_progress(self, session_id: str) -> None:
        self._progress.pop(session_id, None)
        self.cleared.append(session_id)


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


@pytest.mark.asyncio
async def test_driver_persists_progress_to_session_store_after_each_turn() -> None:
    llm = MockLLMProvider(
        extract_fn=lambda prompt, schema: schema.model_validate({"purpose": "screen candidates"})
    )
    graph = IntakeGraph(llm)
    worker = _FakeSessionWorker()
    progress_store = _FakeIntakeProgressStore()

    driver = IntakeSessionDriver(
        session_id="sess-progress",
        owner="owner-1",
        intake_graph=graph,
        session_worker=worker,
        session_store=progress_store,
    )

    await driver.on_utterance(
        TranscribedUtterance(session_id="sess-progress", text="I want an HR agent", is_final=True)
    )

    assert len(progress_store.saved_calls) == 1
    saved_session_id, saved_slots, saved_history = progress_store.saved_calls[0]
    assert saved_session_id == "sess-progress"
    assert saved_slots.purpose == "screen candidates"
    assert saved_history == ["I want an HR agent"]
    assert progress_store.cleared == []


@pytest.mark.asyncio
async def test_driver_clears_progress_from_session_store_on_completion() -> None:
    responses: list[dict[str, object]] = [
        {"purpose": "take HR placement calls"},
        {"caller_persona": "HR teams"},
        {"workflow_steps": ["confirm role", "screen candidate"]},
        {"languages": ["en"]},
    ]
    llm = MockLLMProvider(extract_fn=_extract_fn_sequence(responses))
    graph = IntakeGraph(llm)
    worker = _FakeSessionWorker()
    progress_store = _FakeIntakeProgressStore()

    async def fake_run_intake_session(
        intake_result: IntakeSessionResult, avatar_assignment: AvatarAssignment
    ) -> AgentSpec:
        return _fake_agent_spec(intake_result.session_id)

    driver = IntakeSessionDriver(
        session_id="sess-clear",
        owner="owner-1",
        intake_graph=graph,
        session_worker=worker,
        run_intake_session_fn=fake_run_intake_session,
        session_store=progress_store,
    )

    utterances = [
        "I want an agent that takes HR placement calls",
        "HR teams will call it",
        "confirm role, then screen candidate",
        "just English",
    ]
    for text in utterances:
        await driver.on_utterance(
            TranscribedUtterance(session_id="sess-clear", text=text, is_final=True)
        )

    assert driver.completed is True
    assert progress_store.cleared == ["sess-clear"]
    assert await progress_store.load_intake_progress("sess-clear") is None


@pytest.mark.asyncio
async def test_load_or_create_intake_graph_starts_fresh_when_no_prior_progress() -> None:
    llm = MockLLMProvider(extract_fn=lambda prompt, schema: schema.model_validate({}))
    progress_store = _FakeIntakeProgressStore()

    graph = await _load_or_create_intake_graph(llm, "sess-fresh", progress_store)

    assert graph.slots == IntakeSlots()
    assert graph.history == []


@pytest.mark.asyncio
async def test_load_or_create_intake_graph_rehydrates_from_existing_progress() -> None:
    """This is the actual resume mechanism `intake_entrypoint` relies on: given prior progress
    under a session_id (e.g. because a job crashed or the connection dropped and LiveKit
    redispatched the same room), the graph picks up with the slots/history already filled in,
    instead of asking the user to repeat themselves from scratch."""
    llm = MockLLMProvider(
        extract_fn=lambda prompt, schema: schema.model_validate(
            {"workflow_steps": ["confirm role", "screen candidate"]}
        )
    )
    prior_slots = IntakeSlots(purpose="take HR placement calls", caller_persona="HR teams")
    prior_history = ["I want an agent that takes HR placement calls", "HR teams will call it"]
    progress_store = _FakeIntakeProgressStore(
        existing={"sess-resume": (prior_slots, prior_history)}
    )

    graph = await _load_or_create_intake_graph(llm, "sess-resume", progress_store)

    assert graph.slots.purpose == "take HR placement calls"
    assert graph.slots.caller_persona == "HR teams"
    assert graph.history == prior_history

    # And the rehydrated graph can continue the conversation from here rather than starting
    # over: the next follow-up question should be for a still-missing slot, not "purpose"
    # again.
    result = await graph.step("confirm role, then screen candidate")
    assert result.slots.purpose == "take HR placement calls"
    assert result.slots.workflow_steps == ["confirm role", "screen candidate"]


@pytest.mark.asyncio
async def test_load_or_create_intake_graph_starts_fresh_with_no_session_store() -> None:
    llm = MockLLMProvider(extract_fn=lambda prompt, schema: schema.model_validate({}))

    graph = await _load_or_create_intake_graph(llm, "sess-no-store", None)

    assert graph.slots == IntakeSlots()
    assert graph.history == []


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
