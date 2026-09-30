from collections.abc import Callable

import pytest
from pydantic import BaseModel

from trackb.intake.graph import IntakeGraph
from trackb.intake.schema import IntakeSlots
from trackb.llm.mock import MockLLMProvider


def _scripted_extract(responses: list[IntakeSlots]) -> Callable[[str, type[BaseModel]], BaseModel]:
    """Return an extract_fn that hands back the next scripted IntakeSlots delta per call."""
    calls = {"n": 0}

    def extract_fn(prompt: str, schema: type[BaseModel]) -> BaseModel:
        idx = calls["n"]
        calls["n"] += 1
        return responses[idx]

    return extract_fn


@pytest.mark.asyncio
async def test_multi_turn_conversation_fills_all_slots_and_completes() -> None:
    responses = [
        IntakeSlots(purpose="an agent that takes HR placement calls"),
        IntakeSlots(caller_persona="HR teams and candidates"),
        IntakeSlots(workflow_steps=["confirm role", "screen candidate", "schedule interview"]),
        IntakeSlots(languages=["English"]),
    ]
    llm = MockLLMProvider(extract_fn=_scripted_extract(responses))
    graph = IntakeGraph(llm)

    r1 = await graph.step("I want an agent that takes HR placement calls")
    assert r1.status == "follow_up"
    assert graph.slots.purpose == "an agent that takes HR placement calls"

    r2 = await graph.step("It'll be used by HR teams and candidates")
    assert r2.status == "follow_up"
    assert graph.slots.caller_persona == "HR teams and candidates"

    r3 = await graph.step(
        "It should confirm the role, screen the candidate, then schedule an interview"
    )
    assert r3.status == "follow_up"
    assert graph.slots.workflow_steps == ["confirm role", "screen candidate", "schedule interview"]

    r4 = await graph.step("Just English is fine")
    assert r4.status == "completed"
    assert r4.completed_slots is not None
    assert r4.completed_slots.is_complete()
    assert r4.missing_slots == []
    assert graph.history == [
        "I want an agent that takes HR placement calls",
        "It'll be used by HR teams and candidates",
        "It should confirm the role, screen the candidate, then schedule an interview",
        "Just English is fine",
    ]


@pytest.mark.asyncio
async def test_missing_required_slot_asks_follow_up_instead_of_completing() -> None:
    responses = [
        IntakeSlots(purpose="an agent that takes HR placement calls"),
        IntakeSlots(caller_persona="HR teams"),
        IntakeSlots(workflow_steps=["confirm role", "screen candidate"]),
        # languages is never provided.
    ]
    llm = MockLLMProvider(extract_fn=_scripted_extract(responses))
    graph = IntakeGraph(llm)

    await graph.step("I want an agent that takes HR placement calls")
    await graph.step("It'll be used by HR teams")
    result = await graph.step("It should confirm the role and screen the candidate")

    assert result.status == "follow_up"
    assert result.missing_slots == ["languages"]
    assert result.follow_up_question is not None
    assert not graph.slots.is_complete()


@pytest.mark.asyncio
async def test_follow_up_question_is_specific_to_missing_slot_not_generic() -> None:
    llm = MockLLMProvider(extract_fn=_scripted_extract([IntakeSlots()]))
    graph = IntakeGraph(llm)

    result = await graph.step("Hi, I'd like to build an agent")

    assert result.status == "follow_up"
    assert result.missing_slots[0] == "purpose"
    question = result.follow_up_question
    assert question is not None
    generic_phrases = ["can you clarify", "could you clarify", "please provide more details"]
    assert not any(phrase in question.lower() for phrase in generic_phrases)
    assert "purpose" in question.lower() or "hr placement" in question.lower()


@pytest.mark.asyncio
async def test_follow_up_targets_first_missing_slot_when_several_are_missing() -> None:
    llm = MockLLMProvider(extract_fn=_scripted_extract([IntakeSlots(purpose="something")]))
    graph = IntakeGraph(llm)

    result = await graph.step("I want to build something")

    assert result.status == "follow_up"
    assert result.missing_slots[0] == "caller_persona"
    assert result.follow_up_question is not None
    assert "call" in result.follow_up_question.lower() or "who" in result.follow_up_question.lower()


@pytest.mark.asyncio
async def test_previously_filled_slots_are_not_erased_by_a_later_empty_extraction() -> None:
    responses = [
        IntakeSlots(purpose="an agent that takes HR placement calls"),
        IntakeSlots(),  # utterance carried no new slot information
    ]
    llm = MockLLMProvider(extract_fn=_scripted_extract(responses))
    graph = IntakeGraph(llm)

    await graph.step("I want an agent that takes HR placement calls")
    await graph.step("hmm not sure what else to add")

    assert graph.slots.purpose == "an agent that takes HR placement calls"
