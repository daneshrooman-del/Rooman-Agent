"""The two-function contract other tracks depend on must never drift."""
import inspect

import pytest

import avatar_engine
from avatar_engine import actions


def _positional(fn):
    return [p.name for p in inspect.signature(fn).parameters.values() if p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD)]


def test_create_avatar_signature():
    assert _positional(avatar_engine.create_avatar) == ["video_file"]


def test_generate_signature():
    assert _positional(avatar_engine.generate) == ["avatar_id", "script_or_audio", "action_type"]


def test_extra_options_are_keyword_only_with_defaults():
    for fn in (avatar_engine.create_avatar, avatar_engine.generate):
        for p in inspect.signature(fn).parameters.values():
            if p.kind == p.KEYWORD_ONLY:
                assert p.default is not p.empty, f"{fn.__name__}({p.name}) must have a default"


@pytest.mark.parametrize("name", ["talk", "greet", "TALK", " Greet "])
def test_supported_actions_resolve(name):
    action, spec = actions.resolve(name)
    assert action.value == name.strip().lower()
    assert spec.expression_scale > 0


@pytest.mark.parametrize("name", ["gesture", "walk", "demonstrate"])
def test_body_actions_raise_clearly(name):
    with pytest.raises(avatar_engine.ActionNotSupported, match="full-body"):
        actions.resolve(name)


def test_unknown_action_is_value_error():
    with pytest.raises(ValueError, match="Unknown action_type"):
        actions.resolve("dance")


def test_unknown_avatar(tmp_path):
    with pytest.raises(avatar_engine.AvatarNotFound):
        avatar_engine.generate("av_doesnotexist", "hello", "talk")


def test_missing_video_file(tmp_path):
    with pytest.raises(FileNotFoundError):
        avatar_engine.create_avatar(tmp_path / "nope.mp4")
