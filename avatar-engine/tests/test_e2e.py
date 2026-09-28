"""Full pipeline with the real models: reference video -> twin -> talk/greet videos.

Slow (minutes on a 4 GB GPU). Run with:  pytest -m e2e -s
"""
import json
from pathlib import Path

import pytest

import avatar_engine
from avatar_engine import media

pytestmark = pytest.mark.e2e
EXAMPLES = Path(__file__).resolve().parent.parent / "third_party" / "SadTalker" / "examples"


@pytest.fixture(scope="module")
def twin(request):
    video = EXAMPLES / "ref_video" / "WDA_KatieHill_000.mp4"
    if not video.exists():
        pytest.skip("sample video missing")
    return avatar_engine.create_avatar(video, on_progress=lambda i, m: print(f"  train[{i}] {m}"))


def test_twin_is_ready(twin):
    m = avatar_engine.get_avatar(twin)
    assert m["status"] == "ready", m
    assert m["identity"]["min_similarity"] > 0.363


def test_talk_from_script(twin):
    out = avatar_engine.generate(twin, "Hello, I'm your digital twin. This video was generated from a script.", "talk", on_progress=lambda i, m: print(f"  gen[{i}] {m}"))
    info = media.probe(out)
    assert info["has_video"] and info["has_audio"] and info["duration"] > 2
    report = json.loads(out.with_suffix(".consistency.json").read_text())
    assert report["verdict"] in ("verified", "flagged"), report


def test_talk_from_audio(twin):
    out = avatar_engine.generate(twin, EXAMPLES / "driven_audio" / "RD_Radio31_000.wav", "talk")
    assert media.probe(out)["has_audio"]


def test_greet_uses_default_script(twin):
    out = avatar_engine.generate(twin, "", "greet")
    assert media.probe(out)["duration"] > 1
