from __future__ import annotations

from collections.abc import Callable

import pytest
from pydantic import BaseModel

from trackb.contracts.models import AgentSpec, FlowGraph, FlowState, FlowTransition
from trackb.llm.mock import MockLLMProvider
from trackb.session.flow_engine import FlowEngineError, FlowGraphDriver


def _hr_flow_graph() -> FlowGraph:
    """A 3-state HR-placement flow: greet -> screen -> schedule (terminal)."""
    return FlowGraph(
        entry_state="greet",
        states=[
            FlowState(
                name="greet",
                objective="Greet the candidate and confirm the role they're calling about.",
                transitions=[FlowTransition(on="greeted", to_state="screen")],
            ),
            FlowState(
                name="screen",
                objective="Ask screening questions about the candidate's experience.",
                transitions=[FlowTransition(on="screened", to_state="schedule")],
            ),
            FlowState(
                name="schedule",
                objective="Offer an interview slot and confirm it.",
                transitions=[],
                is_terminal=True,
            ),
        ],
    )


def _agent_spec() -> AgentSpec:
    return AgentSpec(
        agent_id="agent-1",
        owner="owner-1",
        purpose="take HR placement calls",
        persona_prompt="You are a friendly HR placement assistant.",
        flow_graph=_hr_flow_graph(),
        guardrails=["never discuss salary specifics"],
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
async def test_multi_turn_conversation_reaches_terminal_state() -> None:
    responses: list[dict[str, object]] = [
        {"response_text": "Hi! You're calling about the backend role, right?", "signal": "greeted"},
        {"response_text": "Great, tell me about your experience.", "signal": None},
        {"response_text": "Thanks, that's enough for screening.", "signal": "screened"},
        {"response_text": "How about Tuesday at 2pm?", "signal": None},
    ]
    llm = MockLLMProvider(extract_fn=_extract_fn_sequence(responses))
    driver = FlowGraphDriver(_agent_spec(), llm)

    assert driver.current_state == "greet"

    result_1 = await driver.step("Hi, I'm calling about the backend role")
    assert result_1.current_state == "screen"
    assert result_1.is_terminal is False
    assert driver.current_state == "screen"

    result_2 = await driver.step("I have 5 years of experience")
    assert result_2.current_state == "screen"
    assert result_2.is_terminal is False

    result_3 = await driver.step("That's about it")
    assert result_3.current_state == "schedule"
    # Transitioning into a terminal state marks the result terminal on the same turn.
    assert result_3.is_terminal is True

    result_4 = await driver.step("Tuesday at 2pm works")
    assert result_4.current_state == "schedule"
    assert result_4.is_terminal is True

    assert len(driver.history) == 8  # 4 user + 4 agent lines


@pytest.mark.asyncio
async def test_invalid_signal_triggers_corrective_retry_then_succeeds() -> None:
    responses: list[dict[str, object]] = [
        {"response_text": "Let's move on.", "signal": "not-a-real-signal"},
        {"response_text": "Let's move on.", "signal": "greeted"},
    ]
    llm = MockLLMProvider(extract_fn=_extract_fn_sequence(responses))
    driver = FlowGraphDriver(_agent_spec(), llm)

    result = await driver.step("Hi")

    assert result.current_state == "screen"
    assert driver.current_state == "screen"


@pytest.mark.asyncio
async def test_retries_exhausted_raises_clear_error_and_does_not_corrupt_state() -> None:
    llm = MockLLMProvider(
        extract_fn=lambda prompt, schema: schema.model_validate(
            {"response_text": "hmm", "signal": "always-invalid"}
        )
    )
    driver = FlowGraphDriver(_agent_spec(), llm, max_attempts=3)

    with pytest.raises(FlowEngineError, match="greet"):
        await driver.step("Hi")

    # State and history are untouched by the failed turn.
    assert driver.current_state == "greet"
    assert driver.history == []


@pytest.mark.asyncio
async def test_empty_response_text_is_invalid_and_retried() -> None:
    responses: list[dict[str, object]] = [
        {"response_text": "   ", "signal": None},
        {"response_text": "Hello there!", "signal": None},
    ]
    llm = MockLLMProvider(extract_fn=_extract_fn_sequence(responses))
    driver = FlowGraphDriver(_agent_spec(), llm)

    result = await driver.step("Hi")

    assert result.response_text == "Hello there!"
    assert driver.current_state == "greet"


@pytest.mark.asyncio
async def test_single_state_terminal_entry_completes_on_first_turn() -> None:
    spec = AgentSpec(
        agent_id="agent-2",
        owner="owner-1",
        purpose="a trivial single-state agent",
        persona_prompt="You are a simple agent.",
        flow_graph=FlowGraph(
            entry_state="only",
            states=[FlowState(name="only", objective="say hi and end", is_terminal=True)],
        ),
        avatar_id="avatar-1",
        voice_id="voice-1",
        created_from_session_id="session-2",
    )
    llm = MockLLMProvider(
        extract_fn=lambda prompt, schema: schema.model_validate(
            {"response_text": "Goodbye!", "signal": None}
        )
    )
    driver = FlowGraphDriver(spec, llm)

    result = await driver.step("Hi")

    assert result.is_terminal is True
    assert result.current_state == "only"
