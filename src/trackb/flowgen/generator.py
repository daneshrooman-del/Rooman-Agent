"""Turns a completed `IntakeSlots` into a `FlowGraph` via the LLM.

The LLM is asked to produce a `FlowGraph` (states/objectives/transitions) that
satisfies the intake requirements. Its raw output is validated -- every
transition target must be a real state, the entry state must exist, and there
must be at least one terminal state -- and a bad result triggers a bounded,
corrective retry rather than being handed to the caller broken.
"""

import structlog
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt

from trackb.contracts.models import FlowGraph
from trackb.intake.schema import IntakeSlots
from trackb.llm.base import LLMProvider

logger = structlog.get_logger(__name__)

DEFAULT_MAX_ATTEMPTS = 3


class FlowGenerationError(Exception):
    """Raised when the LLM fails to produce a valid FlowGraph within the retry budget."""


class _InvalidFlowGraph(Exception):
    """Internal signal: the LLM's FlowGraph failed validation, retry with a correction."""

    def __init__(self, errors: list[str]) -> None:
        self.errors = errors
        super().__init__("; ".join(errors))


def validate_flow_graph(graph: FlowGraph) -> list[str]:
    """Return a list of human-readable problems with `graph`, empty if it is valid."""
    errors: list[str] = []
    state_names = {state.name for state in graph.states}

    if not state_names:
        errors.append("FlowGraph must contain at least one state")

    if graph.entry_state not in state_names:
        errors.append(f"entry_state {graph.entry_state!r} does not match any state name")

    for state in graph.states:
        for transition in state.transitions:
            if transition.to_state not in state_names:
                errors.append(
                    f"state {state.name!r} has a transition on {transition.on!r} "
                    f"to unknown state {transition.to_state!r}"
                )

    if not any(state.is_terminal for state in graph.states):
        errors.append("FlowGraph must have at least one terminal state")

    return errors


def _build_prompt(slots: IntakeSlots, correction: str | None) -> str:
    lines = [
        "Design a conversational flow graph for a voice/video agent with the following "
        "requirements gathered during intake:",
        f"- Purpose: {slots.purpose}",
        f"- Caller persona: {slots.caller_persona}",
        "- Required inputs the agent must collect: "
        f"{', '.join(slots.required_inputs) or 'none specified'}",
        "- Workflow steps the agent must drive, in order: "
        f"{', '.join(slots.workflow_steps) or 'none specified'}",
        f"- Tools the agent may need: {', '.join(slots.tools_needed) or 'none specified'}",
        f"- Tone: {slots.tone or 'not specified'}",
        "",
        "Produce a FlowGraph with one state per workflow step (plus a greeting state if useful), "
        "sensible transitions between them driven by named signals, exactly one entry_state that "
        "matches a real state name, and at least one terminal state (is_terminal=true) that ends "
        "the call.",
    ]
    if correction:
        lines.append("")
        lines.append(f"Correction needed: {correction}")
    return "\n".join(lines)


async def generate_flow_graph(
    slots: IntakeSlots,
    llm: LLMProvider,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
) -> FlowGraph:
    """Have `llm` produce a `FlowGraph` satisfying `slots`, retrying on invalid output.

    Raises `FlowGenerationError` if no valid graph is produced within `max_attempts`.
    """
    correction: str | None = None
    graph: FlowGraph | None = None

    try:
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(max_attempts),
            retry=retry_if_exception_type(_InvalidFlowGraph),
            reraise=True,
        ):
            with attempt:
                attempt_number = attempt.retry_state.attempt_number
                prompt = _build_prompt(slots, correction)
                graph = await llm.extract(prompt, schema=FlowGraph)
                errors = validate_flow_graph(graph)
                if errors:
                    logger.warning(
                        "flow_generation_invalid",
                        attempt=attempt_number,
                        errors=errors,
                    )
                    correction = (
                        "The previous flow graph was invalid for these reasons: "
                        + "; ".join(errors)
                        + ". Fix these issues in your next response."
                    )
                    raise _InvalidFlowGraph(errors)
    except _InvalidFlowGraph as exc:
        logger.error("flow_generation_failed", max_attempts=max_attempts, errors=exc.errors)
        raise FlowGenerationError(
            f"LLM failed to produce a valid FlowGraph after {max_attempts} attempt(s): {exc}"
        ) from exc

    assert graph is not None  # a value is always assigned before the loop can exit successfully
    logger.info(
        "flow_generated",
        entry_state=graph.entry_state,
        state_count=len(graph.states),
    )
    return graph
