import os
import tempfile
from pathlib import Path

import pytest

# Isolate test data before the package reads its settings.
os.environ.setdefault("AVATAR_ENGINE_DATA_DIR", tempfile.mkdtemp(prefix="avatar_engine_test_"))

ROOT = Path(__file__).resolve().parent.parent
EXAMPLES = ROOT / "third_party" / "SadTalker" / "examples"


def _need(p: Path) -> Path:
    if not p.exists():
        pytest.skip(f"sample asset missing: {p} (run scripts/setup.py)")
    return p


@pytest.fixture
def face_a() -> Path:
    return _need(EXAMPLES / "source_image" / "people_0.png")


@pytest.fixture
def face_b() -> Path:
    return _need(EXAMPLES / "source_image" / "full_body_1.png")


@pytest.fixture
def sample_video() -> Path:
    """A real talking-head clip with audio (ships with SadTalker)."""
    return _need(EXAMPLES / "ref_video" / "WDA_KatieHill_000.mp4")


@pytest.fixture
def other_video() -> Path:
    return _need(EXAMPLES / "ref_video" / "WDA_AlexandriaOcasioCortez_000.mp4")


@pytest.fixture
def speech_wav() -> Path:
    return _need(EXAMPLES / "driven_audio" / "RD_Radio31_000.wav")
