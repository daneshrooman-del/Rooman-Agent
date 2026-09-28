"""Stage 1 on real footage + the user-facing guardrails."""
from pathlib import Path

import cv2
import numpy as np
import pytest

from avatar_engine import media
from avatar_engine.ingest import IngestError, ingest


def _silent_clip(img: np.ndarray, out: Path, seconds: float) -> Path:
    raw = out.with_suffix(".raw.mp4")
    h, w = img.shape[:2]
    vw = cv2.VideoWriter(str(raw), cv2.VideoWriter_fourcc(*"mp4v"), 25, (w, h))
    for _ in range(int(seconds * 25)):
        vw.write(img)
    vw.release()
    return raw


def test_ingest_real_video(sample_video, tmp_path):
    r = ingest(sample_video, tmp_path)
    assert r.audio_wav.exists() and media.probe(r.audio_wav)["duration"] > 5
    assert r.face_mesh.shape[1:] == (468, 3)
    assert r.pose.shape[1:] == (33, 4)
    assert (~np.isnan(r.face_mesh[:, 0, 0])).mean() > 0.9, "face mesh should track most frames"
    assert r.person_mask.dtype == np.uint8 and r.person_mask.max() == 255
    assert r.background.shape[2] == 3
    best = max(r.samples, key=lambda s: s.score)
    assert best.face is not None and best.faces == 1


def test_video_without_audio_is_rejected(face_a, tmp_path):
    clip = _silent_clip(cv2.imread(str(face_a)), tmp_path / "noaudio.mp4", 8)
    with pytest.raises(IngestError, match="no audio"):
        ingest(clip, tmp_path / "w")


def test_too_short_is_rejected(face_a, speech_wav, tmp_path):
    clip = _silent_clip(cv2.imread(str(face_a)), tmp_path / "short.mp4", 2)
    with_audio = media.mux(clip, speech_wav, tmp_path / "short_a.mp4")
    with pytest.raises(IngestError, match="at least"):
        ingest(with_audio, tmp_path / "w")


def test_no_face_is_rejected(speech_wav, tmp_path):
    clip = _silent_clip(np.full((360, 640, 3), 90, np.uint8), tmp_path / "noface.mp4", 8)
    with_audio = media.mux(clip, speech_wav, tmp_path / "noface_a.mp4")
    with pytest.raises(IngestError, match="face"):
        ingest(with_audio, tmp_path / "w")
