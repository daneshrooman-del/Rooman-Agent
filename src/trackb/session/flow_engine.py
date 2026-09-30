"""Drives a live conversation through a deployed `AgentSpec`'s own `FlowGraph`, one turn at a
time.

Mirrors `trackb.intake.graph.IntakeGraph`'s turn-by-turn shape (`step(utterance) -> result`,
accumulated instance state, never a full-transcript batch call) and
`trackb.flowgen.generator.generate_flow_graph`'s "LLM extraction + validation + bounded
corrective retry" pattern -- see both modules' docstrings. Where `IntakeGraph` fills slots,
`FlowGraphDriver` instead asks the LLM for two things per turn: what the agent should say next,
and whether any of the current state's named transition signals fired -- validating the
returned signal is actually one of the current state's real `FlowTransition.on` values (or
absent, to stay put) before trusting it to move `current_state`.
"""

from __future__ import annotations

import asyncio

import structlog
from pydantic import BaseModel
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt

from trackb.contracts.models import AgentSpec, FlowState
from trackb.llm.base import LLMProvider

logger = structlog.get_logger(__name__)

DEFAULT_MAX_ATTEMPTS = 3
STEP_TIMEOUT_SECONDS = 10.0


class FlowEngineError(Exception):
    """Raised when the LLM fails to produce a valid turn within the retry budget."""


class _InvalidTurn(Exception):
    """Internal signal: the LLM's turn output failed validation, retry with a correction."""

    def __init__(self, errors: list[str]) -> None:
        self.errors = errors
        super().__init__("; ".join(errors))


class _TurnExtraction(BaseModel):
    """What the LLM returns for a single conversation turn.

    `signal`, when set, must match one of the current state's `FlowTransition.on` values --
    validated by `_validate_turn` before it's ever trusted to move `current_state`. `None`
    (the default) means "stay in the current state", e.g. because its objective hasn't been
    satisfied by this turn yet.
    """

    response_text: str
    signal: str | None = None


class FlowStepResult(BaseModel):
    """What a single `FlowGraphDriver.step()` call hands back to the caller."""

    response_text: str
    current_state: str
    is_terminal: bool


def _validate_turn(state: FlowState, turn: _TurnExtraction) -> list[str]:
    errors: list[str] = []
    if not turn.response_text.strip():
        errors.append("response_text must be non-empty")

    valid_signals = {transition.on for transition in state.transitions}
    if turn.signal and turn.signal not in valid_signals:
        errors.append(
            f"signal {turn.signal!r} is not a valid transition from state {state.name!r} "
            f"(valid signals: {sorted(valid_signals) or 'none -- this state has no transitions'})"
        )
    return errors


class FlowGraphDriver:
    """Turn-by-turn driver over `agent_spec.flow_graph`.

    Holds accumulated conversation history and the current state name across calls. Each
    `step(utterance)` builds a prompt from the persona, the current state's objective and
    available transition signals, and the guardrails, asks the LLM for a structured turn,
    validates it (retrying up to `max_attempts` times on invalid output), applies any matched
    transition, and returns a `FlowStepResult`.
    """

    def __init__(
        self,
        agent_spec: AgentSpec,
        llm: LLMProvider,
        max_attempts: int = DEFAULT_MAX_ATTEMPTS,
    ) -> None:
        self._agent_spec = agent_spec
        self._llm = llm
        self._max_attempts = max_attempts
        self._states: dict[str, FlowState] = {
            state.name: state for state in agent_spec.flow_graph.states
        }
        self._current_state = agent_spec.flow_graph.entry_state
        self._history: list[str] = []

    @property
    def current_state(self) -> str:
        return self._current_state

    @property
    def history(self) -> list[str]:
        return list(self._history)

    def _build_prompt(self, state: FlowState, utterance: str, correction: str | None) -> str:
        signals = [transition.on for transition in state.transitions]
        transcript = "\n".join(f"- {turn}" for turn in self._history) or "(none yet)"
        lines = [
            self._agent_spec.persona_prompt,
            "",
            f"Current conversation state: {state.name}",
            f"Objective for this state: {state.objective}",
            "Transition signals available from this state (fire at most one, in `signal`, "
            "only once its condition is actually met this turn; leave `signal` null to stay "
            "in this state): " + (", ".join(signals) or "(none -- this state has no outgoing "
            "transitions)"),
            "Guardrails the agent must always follow: "
            + (", ".join(self._agent_spec.guardrails) or "none specified"),
            "",
            f"Conversation so far:\n{transcript}",
            f"Latest user utterance: {utterance!r}",
            "",
            "Respond with the spoken response_text to say next, and the signal (if any) that "
            "fired this turn.",
        ]
        if correction:
            lines.append("")
            lines.append(f"Correction needed: {correction}")
        return "\n".join(lines)

    async def step(self, utterance: str) -> FlowStepResult:
        state = self._states[self._current_state]
        correction: str | None = None
        turn: _TurnExtraction | None = None

        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(self._max_attempts),
                retry=retry_if_exception_type(_InvalidTurn),
                reraise=True,
            ):
                with attempt:
                    attempt_number = attempt.retry_state.attempt_number
                    prompt = self._build_prompt(state, utterance, correction)
                    candidate = await asyncio.wait_for(
                        self._llm.extract(prompt, schema=_TurnExtraction),
                        timeout=STEP_TIMEOUT_SECONDS,
                    )
                    errors = _validate_turn(state, candidate)
                    if errors:
                        logger.warning(
                            "flow_turn_invalid",
                            state=state.name,
                            attempt=attempt_number,
                            errors=errors,
                        )
                        correction = (
                            "The previous response was invalid for these reasons: "
                            + "; ".join(errors)
                            + ". Fix these issues in your next response."
                        )
                        raise _InvalidTurn(errors)
                    turn = candidate
        except _InvalidTurn as exc:
            logger.error(
                "flow_turn_failed",
                state=state.name,
                max_attempts=self._max_attempts,
                errors=exc.errors,
            )
            raise FlowEngineError(
                f"LLM failed to produce a valid turn for state {state.name!r} after "
                f"{self._max_attempts} attempt(s): {exc}"
            ) from exc

        assert turn is not None  # a value is always assigned before the loop can exit successfully
        self._history.append(f"user: {utterance}")
        self._history.append(f"agent: {turn.response_text}")

        new_state_name = self._current_state
        if turn.signal:
            for transition in state.transitions:
                if transition.on == turn.signal:
                    new_state_name = transition.to_state
                    break

        if new_state_name != self._current_state:
            logger.info(
                "flow_state_transitioned",
                from_state=self._current_state,
                to_state=new_state_name,
                signal=turn.signal,
            )
            self._current_state = new_state_name

        new_state = self._states[self._current_state]
        is_terminal = new_state.is_terminal
        if is_terminal:
            logger.info("flow_conversation_completed", state=self._current_state)

        return FlowStepResult(
            response_text=turn.response_text,
            current_state=self._current_state,
            is_terminal=is_terminal,
        )
