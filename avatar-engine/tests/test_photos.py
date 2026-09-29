"""Photo → avatar guardrails (no heavy models needed: they fail before the workers run)."""
from pathlib import Path

import cv2
import numpy as np
import pytest

import avatar_engine
from avatar_engine.photo_twin import PhotoError


def test_signature_is_additive():
    import inspect

    params = inspect.signature(avatar_engine.create_avatar_from_photos).parameters
    assert list(params)[0] == "photos"
    assert all(p.default is not p.empty for n, p in params.items() if n != "photos")


def test_different_people_are_rejected(face_a, face_b):
    with pytest.raises(PhotoError, match="same person"):
        avatar_engine.create_avatar_from_photos([face_a, face_a, face_b])


def test_photo_without_face_is_rejected(face_a, tmp_path):
    blank = tmp_path / "wall.png"
    cv2.imwrite(str(blank), np.full((600, 600, 3), 120, np.uint8))
    with pytest.raises(PhotoError, match="No face"):
        avatar_engine.create_avatar_from_photos([face_a, blank])


def test_too_many_photos(face_a):
    with pytest.raises(PhotoError, match="between 1 and 5"):
        avatar_engine.create_avatar_from_photos([face_a] * 6)


def test_not_an_image(tmp_path):
    f = tmp_path / "notes.txt"
    f.write_text("hi")
    with pytest.raises(PhotoError, match="supported image"):
        avatar_engine.create_avatar_from_photos([f])


def test_bad_voice_clip_falls_back_to_stock_voice(face_a, tmp_path, monkeypatch):
    """A voice problem must never stop avatar creation."""
    from avatar_engine import media, photo_twin
    from avatar_engine.workers.runner import WorkerError

    calls = []

    def fake_worker(python, script, req, **kw):
        calls.append(req["op"])
        if req["op"] == "clone":
            raise WorkerError("voice model crashed")
        if req["op"] == "stock":
            return {"speaker": req["speaker"]}
        Path(req["out_dir"]).mkdir(parents=True, exist_ok=True)  # SadTalker prepare
        return {"first_coeff": "x", "crop_pic": "y"}

    monkeypatch.setattr(photo_twin, "run_worker", fake_worker)
    monkeypatch.setattr(photo_twin.media, "extract_clean_audio", lambda src, out: out)
    monkeypatch.setattr(photo_twin.media, "probe", lambda p: {"duration": 20.0})
    clip = tmp_path / "voice.wav"
    clip.write_bytes(b"x")
    avatar_id = photo_twin.build_from_photos([face_a], voice_sample=clip)
    m = media.read_json(photo_twin.settings.avatars_dir / avatar_id / "manifest.json")
    assert m["status"] == "ready"
    assert m["voice"]["type"] == "stock"
    assert any("stock voice" in w for w in m["warnings"])
    assert calls == ["prepare", "clone", "stock"]
