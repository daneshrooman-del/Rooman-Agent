import pytest
from pydantic import BaseModel

from trackb.contracts.models import FlowGraph, FlowState, FlowTransition
from trackb.flowgen import FlowGenerationError, generate_flow_graph, validate_flow_graph
from trackb.intake.schema import IntakeSlots
from trackb.llm.mock import MockLLMProvider


def _sample_slots() -> IntakeSlots:
    return IntakeSlots(
        purpose="an agent that takes HR placement calls",
        caller_persona="HR teams",
        required_inputs=["job requirements", "candidate details"],
        workflow_steps=["confirm role", "screen candidate", "schedule interview"],
        tools_needed=["ATS", "calendar"],
        tone="professional and warm",
        languages=["en"],
    )


def _valid_graph() -> FlowGraph:
    return FlowGraph(
        entry_state="confirm_role",
        states=[
            FlowState(
                name="confirm_role",
                objective="Confirm which role the call is about",
                transitions=[FlowTransition(on="role_confirmed", to_state="screen_candidate")],
            ),
            FlowState(
                name="screen_candidate",
                objective="Screen the candidate against role requirements",
                transitions=[
                    FlowTransition(on="screening_complete", to_state="schedule_interview")
                ],
            ),
            FlowState(
                name="schedule_interview",
                objective="Schedule an interview slot",
                transitions=[FlowTransition(on="interview_scheduled", to_state="done")],
            ),
            FlowState(name="done", objective="Close out the call", is_terminal=True),
        ],
    )


def _graph_with_bad_transition_and_no_terminal() -> FlowGraph:
    return FlowGraph(
        entry_state="confirm_role",
        states=[
            FlowState(
                name="confirm_role",
                objective="Confirm which role the call is about",
                # points at a state that doesn't exist
                transitions=[FlowTransition(on="role_confirmed", to_state="nonexistent_state")],
            ),
        ],
    )


async def test_valid_flow_graph_passes_straight_through() -> None:
    valid = _valid_graph()

    def extract_fn(prompt: str, schema: type[BaseModel]) -> BaseModel:
        assert schema is FlowGraph
        return valid

    llm = MockLLMProvider(extract_fn=extract_fn)

    result = await generate_flow_graph(_sample_slots(), llm)

    assert result == valid
    assert not validate_flow_graph(result)


async def test_invalid_first_attempt_retries_with_corrected_version() -> None:
    calls: list[str] = []
    valid = _valid_graph()

    def extract_fn(prompt: str, schema: type[BaseModel]) -> BaseModel:
        calls.append(prompt)
        if len(calls) == 1:
            return _graph_with_bad_transition_and_no_terminal()
        return valid

    llm = MockLLMProvider(extract_fn=extract_fn)

    result = await generate_flow_graph(_sample_slots(), llm, max_attempts=3)

    assert result == valid
    assert len(calls) == 2
    # the second attempt's prompt must carry a corrective note referencing what was wrong
    assert "Correction needed" in calls[1]
    assert "nonexistent_state" in calls[1]


async def test_repeated_invalid_attempts_raise_instead_of_returning_broken_graph() -> None:
    calls: list[str] = []
    invalid = _graph_with_bad_transition_and_no_terminal()

    def extract_fn(prompt: str, schema: type[BaseModel]) -> BaseModel:
        calls.append(prompt)
        return invalid

    llm = MockLLMProvider(extract_fn=extract_fn)

    with pytest.raises(FlowGenerationError):
        await generate_flow_graph(_sample_slots(), llm, max_attempts=3)

    assert len(calls) == 3


def test_validate_flow_graph_reports_missing_entry_state() -> None:
    graph = FlowGraph(
        entry_state="does_not_exist",
        states=[FlowState(name="only_state", objective="x", is_terminal=True)],
    )
    errors = validate_flow_graph(graph)
    assert any("entry_state" in err for err in errors)


def test_validate_flow_graph_reports_no_terminal_state() -> None:
    graph = FlowGraph(
        entry_state="a",
        states=[
            FlowState(name="a", objective="x", transitions=[FlowTransition(on="go", to_state="a")])
        ],
    )
    errors = validate_flow_graph(graph)
    assert any("terminal" in err for err in errors)
