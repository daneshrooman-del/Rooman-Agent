"""Stage 1 — video ingestion.

reference video ──► clean speech audio
                ├─► per-frame face box + 5-pt landmarks (YuNet), 468-pt face mesh, 33-pt body pose (MediaPipe)
                ├─► person/background segmentation + clean background plate
                └─► scored candidate reference frames
"""
from __future__ import annotations

import math
import warnings
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

from . import identity, media
from .config import settings

SAMPLE_FPS = 4.0
MAX_SAMPLES = 360  # 90 s of footage at 4 fps — bounds RAM on small machines
WORK_WIDTH = 640


class IngestError(ValueError):
    """The reference video can't be used (reason is user-facing)."""


@dataclass
class Sample:
    t: float
    frame: np.ndarray  # BGR, WORK_WIDTH wide
    face: identity.Face | None
    faces: int
    score: float = 0.0


@dataclass
class IngestResult:
    duration: float
    fps: float
    width: int
    height: int
    audio_wav: Path
    samples: list[Sample]
    face_mesh: np.ndarray  # (N, 468, 3) normalised, NaN where no face
    pose: np.ndarray  # (N, 33, 4) x, y, z, visibility, NaN where no body
    person_mask: np.ndarray  # uint8 mask of the best reference frame
    background: np.ndarray  # BGR clean plate
    warnings: list[str] = field(default_factory=list)


def _read_samples(video: Path, duration: float) -> list[tuple[float, np.ndarray]]:
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise IngestError("Could not open the video file.")
    step = max(1.0 / SAMPLE_FPS, duration / MAX_SAMPLES)
    out: list[tuple[float, np.ndarray]] = []
    t = 0.0
    while t < duration:
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, frame = cap.read()
        if not ok:
            break
        h, w = frame.shape[:2]
        scale = WORK_WIDTH / w
        out.append((t, cv2.resize(frame, (WORK_WIDTH, round(h * scale)), interpolation=cv2.INTER_AREA)))
        t += step
    cap.release()
    return out


def _score(s: Sample) -> float:
    """Reference-frame quality: single, large, sharp, frontal face."""
    if s.face is None or s.faces != 1:
        return 0.0
    h, w = s.frame.shape[:2]
    size = s.face.area / (w * h)
    return identity.frontalness(s.face) * math.log1p(identity.sharpness(s.frame, s.face)) * min(size / 0.04, 1.0) * s.face.score


def _landmarks(frames: list[np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    import mediapipe as mp

    mesh = np.full((len(frames), 468, 3), np.nan, dtype=np.float32)
    pose = np.full((len(frames), 33, 4), np.nan, dtype=np.float32)
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1) as fm, mp.solutions.pose.Pose(
        static_image_mode=False, model_complexity=1
    ) as pm:
        for i, f in enumerate(frames):
            rgb = cv2.cvtColor(f, cv2.COLOR_BGR2RGB)
            r = fm.process(rgb)
            if r.multi_face_landmarks:
                mesh[i] = [(p.x, p.y, p.z) for p in r.multi_face_landmarks[0].landmark[:468]]
            r = pm.process(rgb)
            if r.pose_landmarks:
                pose[i] = [(p.x, p.y, p.z, p.visibility) for p in r.pose_landmarks.landmark]
    return mesh, pose


def _openness(mesh: np.ndarray, top: int, bottom: int, left: int, right: int) -> np.ndarray:
    """Vertical / horizontal landmark distance ratio (eye aspect ratio style), per frame."""
    v = np.linalg.norm(mesh[:, top, :2] - mesh[:, bottom, :2], axis=1)
    h = np.linalg.norm(mesh[:, left, :2] - mesh[:, right, :2], axis=1) + 1e-6
    return v / h


def _prefer_neutral_expression(samples: list[Sample], mesh: np.ndarray) -> None:
    """The reference frame gets animated for every video: it should have eyes open and mouth closed.

    Down-weights blinks / squints (eye aspect ratio) and open-mouth frames (mid-word) using the face mesh.
    """
    eyes = (_openness(mesh, 159, 145, 33, 133) + _openness(mesh, 386, 374, 362, 263)) / 2
    mouth = _openness(mesh, 13, 14, 78, 308)
    typical_eye = np.nanmedian(eyes) if np.isfinite(eyes).any() else np.nan
    for i, s in enumerate(samples):
        if s.score <= 0 or not np.isfinite(eyes[i]) or not np.isfinite(typical_eye):
            continue
        eye_factor = float(np.clip(eyes[i] / (typical_eye + 1e-6), 0.0, 1.0)) ** 2  # blink -> ~0
        mouth_factor = float(np.clip(1.0 - mouth[i] / 0.35, 0.05, 1.0))  # wide open -> 0.05
        s.score *= eye_factor * mouth_factor


def _segment(frames: list[np.ndarray]) -> list[np.ndarray]:
    import mediapipe as mp

    masks = []
    with mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1) as seg:
        for f in frames:
            m = seg.process(cv2.cvtColor(f, cv2.COLOR_BGR2RGB)).segmentation_mask
            masks.append(((m > 0.5) * 255).astype(np.uint8))
    return masks


def _clean_plate(frames: list[np.ndarray], masks: list[np.ndarray]) -> np.ndarray:
    """Median of background pixels across time; holes (always-occupied) are inpainted."""
    stack = np.stack(frames).astype(np.float32)
    person = np.stack(masks) > 0
    grown = np.stack([cv2.dilate(m, np.ones((15, 15), np.uint8)) > 0 for m in masks])
    stack[grown | person] = np.nan
    with warnings.catch_warnings():  # pixels the person always covers are all-NaN; inpainted below
        warnings.simplefilter("ignore", RuntimeWarning)
        plate = np.nanmedian(stack, axis=0)
    holes = np.isnan(plate).any(axis=2)
    plate = np.nan_to_num(plate).astype(np.uint8)
    if holes.any():
        plate = cv2.inpaint(plate, holes.astype(np.uint8) * 255, 5, cv2.INPAINT_TELEA)
    return plate


def ingest(video: Path, work_dir: Path) -> IngestResult:
    info = media.probe(video)
    if not info["has_video"]:
        raise IngestError("The file has no video stream.")
    if info["duration"] < settings.min_video_seconds:
        raise IngestError(f"The video is {info['duration']:.1f}s — at least {settings.min_video_seconds:.0f}s is needed.")
    if not info["has_audio"]:
        raise IngestError("The video has no audio. Your voice is needed to clone it — record with sound on.")

    work_dir.mkdir(parents=True, exist_ok=True)
    audio = media.extract_clean_audio(video, work_dir / "voice_clean.wav")
    warnings: list[str] = []

    raw = _read_samples(video, info["duration"])
    samples: list[Sample] = []
    for t, frame in raw:
        faces = identity.detect(frame)
        samples.append(Sample(t=t, frame=frame, face=faces[0] if faces else None, faces=len(faces)))
    for s in samples:
        s.score = _score(s)

    with_face = [s for s in samples if s.face is not None]
    if len(with_face) < max(3, 0.3 * len(samples)):
        raise IngestError("We couldn't see a face clearly in most of the video. Face the camera in good, even light.")
    multi = sum(1 for s in samples if s.faces > 1) / len(samples)
    if multi > 0.3:
        raise IngestError("More than one person appears in the video. The reference must show only you.")
    if multi > 0:
        warnings.append(f"A second face appears in {multi:.0%} of frames; those frames were ignored.")
    if max(s.score for s in samples) <= 0:
        raise IngestError("No frame shows a single, clear, front-facing face.")

    mesh, pose = _landmarks([s.frame for s in samples])
    _prefer_neutral_expression(samples, mesh)
    if np.isnan(pose[:, 0, 0]).mean() > 0.5:
        warnings.append("Upper body is out of frame in most shots — gestures will be limited to the head.")

    masks = _segment([s.frame for s in samples])
    best = max(range(len(samples)), key=lambda i: samples[i].score)
    step = max(1, len(samples) // 40)  # ~40 frames is plenty for a median plate and bounds RAM
    background = _clean_plate([s.frame for s in samples][::step], masks[::step])

    return IngestResult(
        duration=info["duration"],
        fps=info["fps"] or 25.0,
        width=info["width"],
        height=info["height"],
        audio_wav=audio,
        samples=samples,
        face_mesh=mesh,
        pose=pose,
        person_mask=masks[best],
        background=background,
        warnings=warnings,
    )
