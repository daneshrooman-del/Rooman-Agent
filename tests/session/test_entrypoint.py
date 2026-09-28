import pytest

from trackb.contracts.models import AgentSpec, FlowGraph
from trackb.intake.graph import IntakeGraph
from trackb.intake.schema import IntakeSlots
from trackb.llm.mock import MockLLMProvider
from trackb.provisioning.interfaces import AvatarAssignment, IntakeSessionResult
from trackb.session.entrypoint import CLOSING_MESSAGE, IntakeSessionDriver
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


def _extract_fn_sequence(responses: list[dict[str, object]]) -> object:
    calls = {"n": 0}

    def _extract(prompt: str, schema: type[IntakeSlots]) -> IntakeSlots:
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
