"""Turn-by-turn intake slot-filling, implemented as a LangGraph state graph.

`IntakeGraph` drives one user utterance at a time through: (1) an LLM extraction pass that
updates whichever `IntakeSlots` fields that utterance provided, (2) a check against
`IntakeSlots.missing_required_slots()`, and (3) either a specific follow-up question for the
next missing slot or a completion signal. It never waits for a full transcript up front --
callers (Track C's API layer, the LiveKit session loop) call `step()` once per utterance.
"""

import asyncio
from typing import Any, Literal, TypedDict

import structlog
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential

from trackb.intake.schema import IntakeSlots
from trackb.llm.base import LLMProvider

logger = structlog.get_logger(__name__)

_EXTRACTION_TIMEOUT_SECONDS = 10.0

_FOLLOW_UP_QUESTIONS: dict[str, str] = {
    "purpose": (
        "What should this agent's main purpose be -- for example, "
        "'take HR placement calls' or 'handle appointment scheduling'?"
    ),
    "caller_persona": (
        "Who will be calling or using this agent once it's deployed -- "
        "for example HR teams, candidates, or customers?"
    ),
    "workflow_steps": (
        "What are the ordered steps this agent should walk through during a call, "
        "for example 'confirm role', 'screen candidate', 'schedule interview'?"
    ),
    "languages": "Which language or languages does this agent need to operate in?",
}

_EXTRACTION_SYSTEM_PROMPT = (
    "You are extracting structured requirements for a new task-specific voice/video agent "
    "from a live conversation with the person requesting it. Given the conversation so far "
    "and the latest thing they said, return only the fields you can confidently fill in or "
    "update from that latest utterance. Leave any field you have no new information for at "
    "its default (null / empty list)."
)


def _question_for_slot(slot_name: str) -> str:
    return _FOLLOW_UP_QUESTIONS.get(
        slot_name, f"Could you tell me more about {slot_name.replace('_', ' ')}?"
    )


def _describe_slots() -> str:
    return "\n".join(
        f"- {name}: {field.description}" for name, field in IntakeSlots.model_fields.items()
    )


def _build_extraction_prompt(slots: IntakeSlots, history: list[str], utterance: str) -> str:
    known = slots.model_dump_json(exclude_none=True)
    transcript = "\n".join(f"- {turn}" for turn in history) or "(none yet)"
    return (
        "Slots to extract (fill in only what the latest utterance provides):\n"
        f"{_describe_slots()}\n\n"
        f"Already known: {known}\n\n"
        f"Conversation so far:\n{transcript}\n\n"
        f"Latest user utterance: {utterance!r}"
    )


def _is_empty(value: object) -> bool:
    return value is None or value == "" or value == []


def _merge_slots(current: IntakeSlots, extracted: IntakeSlots) -> IntakeSlots:
    updates: dict[str, object] = {}
    for name in IntakeSlots.model_fields:
        value = getattr(extracted, name)
        if not _is_empty(value):
            updates[name] = value
    return current.model_copy(update=updates) if updates else current


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, max=4))
async def _extract_with_retry(llm: LLMProvider, prompt: str) -> IntakeSlots:
    return await asyncio.wait_for(
        llm.extract(prompt, IntakeSlots, system=_EXTRACTION_SYSTEM_PROMPT),
        timeout=_EXTRACTION_TIMEOUT_SECONDS,
    )


class IntakeState(TypedDict):
    slots: IntakeSlots
    utterance: str
    history: list[str]
    follow_up_question: str | None
    is_complete: bool


class IntakeStepResult(BaseModel):
    """What a single `IntakeGraph.step()` call hands back to the caller."""

    model_config = {"arbitrary_types_allowed": True}

    status: Literal["follow_up", "completed"]
    slots: IntakeSlots
    missing_slots: list[str] = Field(default_factory=list)
    follow_up_question: str | None = None
    completed_slots: IntakeSlots | None = None


class IntakeGraph:
    """Turn-by-turn slot-filling conversation graph.

    Holds accumulated `IntakeSlots` state across calls. Each `step(utterance)` runs one pass
    of the underlying LangGraph (extract -> route -> follow_up | complete) and returns an
    `IntakeStepResult` -- never a full-transcript batch call.
    """

    def __init__(self, llm: LLMProvider, initial_slots: IntakeSlots | None = None) -> None:
        self._llm = llm
        self._slots = initial_slots or IntakeSlots()
        self._history: list[str] = []
        self._compiled = self._build_graph()

    @property
    def slots(self) -> IntakeSlots:
        return self._slots

    @property
    def history(self) -> list[str]:
        return list(self._history)

    async def step(self, utterance: str) -> IntakeStepResult:
        state: IntakeState = {
            "slots": self._slots,
            "utterance": utterance,
            "history": list(self._history),
            "follow_up_question": None,
            "is_complete": False,
        }
        result: IntakeState = await self._compiled.ainvoke(state)
        self._slots = result["slots"]
        self._history.append(utterance)

        if result["is_complete"]:
            logger.info("intake_completed", slots=self._slots.model_dump())
            return IntakeStepResult(
                status="completed",
                slots=self._slots,
                missing_slots=[],
                completed_slots=self._slots,
            )

        missing = self._slots.missing_required_slots()
        question = result["follow_up_question"]
        assert question is not None  # follow_up node always sets this
        logger.info("intake_follow_up", missing_slots=missing, question=question)
        return IntakeStepResult(
            status="follow_up",
            slots=self._slots,
            missing_slots=missing,
            follow_up_question=question,
        )

    async def _extract_node(self, state: IntakeState) -> dict[str, Any]:
        prompt = _build_extraction_prompt(state["slots"], state["history"], state["utterance"])
        extracted = await _extract_with_retry(self._llm, prompt)
        merged = _merge_slots(state["slots"], extracted)

        newly_filled = [
            name
            for name in IntakeSlots.model_fields
            if _is_empty(getattr(state["slots"], name)) and not _is_empty(getattr(merged, name))
        ]
        if newly_filled:
            logger.info("slot_filled", slots=newly_filled)

        return {"slots": merged}

    @staticmethod
    def _route(state: IntakeState) -> str:
        return "complete" if not state["slots"].missing_required_slots() else "follow_up"

    @staticmethod
    def _follow_up_node(state: IntakeState) -> dict[str, Any]:
        missing = state["slots"].missing_required_slots()
        return {"follow_up_question": _question_for_slot(missing[0]), "is_complete": False}

    @staticmethod
    def _complete_node(state: IntakeState) -> dict[str, Any]:
        return {"is_complete": True, "follow_up_question": None}

    def _build_graph(self) -> Any:
        graph: StateGraph[IntakeState] = StateGraph(IntakeState)
        graph.add_node("extract", self._extract_node)
        graph.add_node("follow_up", self._follow_up_node)
        graph.add_node("complete", self._complete_node)

        graph.set_entry_point("extract")
        graph.add_conditional_edges(
            "extract",
            self._route,
            {"follow_up": "follow_up", "complete": "complete"},
        )
        graph.add_edge("follow_up", END)
        graph.add_edge("complete", END)

        return graph.compile()
