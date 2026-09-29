"""Bugs found with real user uploads — keep them fixed."""
from pathlib import Path

import cv2
import pytest

from avatar_engine import identity, media


def test_phone_rotation_is_applied(face_a, speech_wav, tmp_path):
    """Phones store portrait video as landscape + a rotation flag; OpenCV ignores the flag."""
    img = cv2.rotate(cv2.imread(str(face_a)), cv2.ROTATE_90_CLOCKWISE)  # sensor-orientation frames
    raw = tmp_path / "raw.mp4"
    h, w = img.shape[:2]
    vw = cv2.VideoWriter(str(raw), cv2.VideoWriter_fourcc(*"mp4v"), 25, (w, h))
    for _ in range(50):
        vw.write(img)
    vw.release()
    rotated = tmp_path / "phone.mp4"
    try:
        media.ffmpeg("-display_rotation", "90", "-i", raw, "-i", speech_wav, "-c:v", "copy", "-c:a", "aac", "-shortest", rotated)
    except media.MediaError:
        pytest.skip("bundled ffmpeg can't write display rotation")

    cap = cv2.VideoCapture(str(rotated))
    _, sideways = cap.read()
    cap.release()
    assert sideways.shape[:2] == (h, w), "precondition: raw OpenCV read ignores the rotation flag"

    upright = media.normalize_video(rotated, tmp_path / "upright.mp4")
    cap = cv2.VideoCapture(str(upright))
    _, frame = cap.read()
    cap.release()
    orig_h, orig_w = cv2.imread(str(face_a)).shape[:2]
    assert abs(frame.shape[0] - orig_h) <= 2 and abs(frame.shape[1] - orig_w) <= 2, "normalized video must be upright"
    assert identity.detect(frame)


def test_tavus_plan_error_falls_back_to_local(monkeypatch, tmp_path):
    from avatar_engine import twin
    from avatar_engine.config import settings
    from avatar_engine.providers import tavus, tavus_pipeline

    def no_plan(*a, **k):
        raise tavus.TavusPlanError("Tavus POST /v2/faces failed (402): Payment required")

    class Reached(Exception):
        pass

    def stop_at_ingest(*a, **k):
        raise Reached

    monkeypatch.setattr(tavus_pipeline, "build", no_plan)
    monkeypatch.setattr(twin, "ingest", stop_at_ingest)
    monkeypatch.setattr(twin.media, "normalize_video", lambda src, out, **k: src)
    object.__setattr__(settings, "provider", "tavus")
    try:
        video = tmp_path / "me.mp4"
        video.write_bytes(b"x")
        with pytest.raises(Reached):  # got past Tavus into the local pipeline
            twin.build_twin(video, avatar_id="av_fallbacktest")
        manifest = media.read_json(settings.avatars_dir / "av_fallbacktest" / "manifest.json")
        assert manifest["provider"] == "local"
        assert any("trained locally" in w for w in manifest["warnings"])
    finally:
        object.__setattr__(settings, "provider", "local")


def test_webm_without_duration_header_is_measured(face_a, speech_wav, tmp_path):
    """Browser MediaRecorder WebM has no duration in its header."""
    img = cv2.imread(str(face_a))
    raw = tmp_path / "raw.mp4"
    h, w = img.shape[:2]
    vw = cv2.VideoWriter(str(raw), cv2.VideoWriter_fourcc(*"mp4v"), 25, (w, h))
    for _ in range(100):
        vw.write(img)
    vw.release()
    webm = tmp_path / "rec.webm"
    # live-style muxing (no seek back to write the duration) mimics MediaRecorder output
    media.ffmpeg("-i", raw, "-i", speech_wav, "-c:v", "libvpx", "-b:v", "500k", "-c:a", "libopus", "-shortest", "-live", "1", "-f", "webm", webm)
    assert media.probe(Path(webm))["duration"] > 2


def test_very_large_face_is_detected(face_a):
    """Close-up phone video upscaled to 1080x1920: faces ~900 px wide were missed by YuNet."""
    img = cv2.imread(str(face_a))
    big = cv2.resize(img, None, fx=2400 / max(img.shape[:2]), fy=2400 / max(img.shape[:2]), interpolation=cv2.INTER_CUBIC)
    faces = identity.detect(big)
    assert faces, "large face must be found"
    small_faces = identity.detect(img)
    ratio = faces[0].box[2] / small_faces[0].box[2]
    assert 0.8 * big.shape[1] / img.shape[1] < ratio < 1.2 * big.shape[1] / img.shape[1], "box is in full-resolution coordinates"
    assert identity.similarity(identity.embed(big, faces[0]), identity.embed(img, small_faces[0])) > 0.6
