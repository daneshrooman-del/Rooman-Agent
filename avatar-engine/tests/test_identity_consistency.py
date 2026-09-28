"""Identity embeddings + the per-frame consistency guardrail, on real faces."""
from pathlib import Path

import cv2
import numpy as np

from avatar_engine import identity
from avatar_engine.consistency import check_video


def _anchor(img_path: Path) -> np.ndarray:
    img = cv2.imread(str(img_path))
    faces = identity.detect(img)
    assert faces, f"no face in {img_path.name}"
    return identity.embed(img, faces[0])


def _video_from(frames: list[np.ndarray], out: Path, fps: int = 25) -> Path:
    h, w = frames[0].shape[:2]
    vw = cv2.VideoWriter(str(out), cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    for f in frames:
        vw.write(cv2.resize(f, (w, h)))
    vw.release()
    return out


def test_same_person_is_similar(face_a):
    img = cv2.imread(str(face_a))
    a = _anchor(face_a)
    flipped = cv2.flip(img, 1)
    b = identity.embed(flipped, identity.detect(flipped)[0])
    assert identity.similarity(a, b) > 0.363


def test_different_people_are_not(face_a, face_b):
    assert identity.similarity(_anchor(face_a), _anchor(face_b)) < 0.363


def test_consistent_video_is_verified(face_a, tmp_path):
    img = cv2.imread(str(face_a))
    frames = [np.clip(img.astype(np.int16) + d, 0, 255).astype(np.uint8) for d in range(-10, 10)]  # lighting jitter
    report = check_video(_video_from(frames, tmp_path / "same.mp4"), _anchor(face_a))
    assert report.verdict == "verified", report
    assert report.match_ratio == 1.0
    assert report.checked == len(frames)


def test_identity_swap_mid_video_is_caught(face_a, face_b, tmp_path):
    a, b = cv2.imread(str(face_a)), cv2.imread(str(face_b))
    b = cv2.resize(b, (a.shape[1], a.shape[0]))
    frames = [a] * 30 + [b] * 4 + [a] * 30  # 4 drifted frames ≈ 6%
    report = check_video(_video_from(frames, tmp_path / "swap.mp4"), _anchor(face_a))
    assert report.verdict == "flagged", report
    assert len(report.drifted_segments) == 1
    seg = report.drifted_segments[0]
    assert 1.1 <= seg["start_s"] <= 1.3 and 1.3 <= seg["end_s"] <= 1.45


def test_wrong_person_is_rejected(face_a, face_b, tmp_path):
    b = cv2.imread(str(face_b))
    report = check_video(_video_from([b] * 20, tmp_path / "other.mp4"), _anchor(face_a))
    assert report.verdict == "rejected"


def test_faceless_video_is_rejected(face_a, tmp_path):
    blank = np.full((256, 256, 3), 40, np.uint8)
    report = check_video(_video_from([blank] * 10, tmp_path / "blank.mp4"), _anchor(face_a))
    assert report.verdict == "rejected" and "No face" in report.reason
