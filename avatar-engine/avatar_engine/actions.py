"""Stage 3 — action generation: how each action type drives the twin.

Each action maps to renderer settings. talk and greet are fully supported by
the face-animation stack. gesture / walk / demonstrate need body motion, which
SadTalker (a face/head model) cannot produce — they raise
ActionNotSupported until a body-motion model is plugged in here.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class ActionType(str, Enum):
    TALK = "talk"
    GREET = "greet"
    GESTURE = "gesture"
    WALK = "walk"
    DEMONSTRATE = "demonstrate"


class ActionNotSupported(NotImplementedError):
    pass


@dataclass(frozen=True)
class ActionSpec:
    use_ref_pose: bool  # borrow the person's own head motion from their reference video
    pose_style: int  # SadTalker pose style (0–45) when not using ref pose
    expression_scale: float
    still: bool  # keep head/shoulders anchored in the original frame (full-frame paste-back)
    default_script: str | None = None


ACTIONS: dict[ActionType, ActionSpec] = {
    ActionType.TALK: ActionSpec(use_ref_pose=True, pose_style=0, expression_scale=1.0, still=True),
    ActionType.GREET: ActionSpec(
        use_ref_pose=False, pose_style=12, expression_scale=1.25, still=True,
        default_script="Hello! It's really nice to meet you. Welcome.",
    ),
}

_BODY_ACTIONS = {ActionType.GESTURE, ActionType.WALK, ActionType.DEMONSTRATE}


def resolve(action_type: str | ActionType) -> tuple[ActionType, ActionSpec]:
    try:
        action = ActionType(str(getattr(action_type, "value", action_type)).lower().strip())
    except ValueError:
        raise ValueError(f"Unknown action_type '{action_type}'. Use one of: {', '.join(a.value for a in ActionType)}") from None
    if action in _BODY_ACTIONS:
        raise ActionNotSupported(
            f"'{action.value}' needs full-body motion generation, which the current face-animation model "
            "(SadTalker) can't produce. Supported now: talk, greet."
        )
    return action, ACTIONS[action]
