"""Photo → avatar guardrails (no heavy models needed: they fail before the workers run)."""
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
