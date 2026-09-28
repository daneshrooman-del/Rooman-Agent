"""Face detection + identity embeddings (OpenCV Zoo YuNet + SFace, Apache-2.0).

Used twice: to pick the best reference frames when building a twin, and to
verify every generated frame is still the same person (consistency check).
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import cv2
import numpy as np

from .config import settings

DET_MODEL = "face_detection_yunet_2023mar.onnx"
REC_MODEL = "face_recognition_sface_2021dec.onnx"


@dataclass
class Face:
    box: tuple[int, int, int, int]  # x, y, w, h
    score: float
    landmarks: np.ndarray  # 5 points (eyes, nose, mouth corners), shape (5, 2)
    raw: np.ndarray  # YuNet row, needed by SFace.alignCrop

    @property
    def area(self) -> int:
        return self.box[2] * self.box[3]


@lru_cache(maxsize=1)
def _recognizer() -> cv2.FaceRecognizerSF:
    path = settings.models_dir / REC_MODEL
    if not path.exists():
        raise FileNotFoundError(f"Missing {path} — run `py -3.10 scripts/setup.py --only models`")
    return cv2.FaceRecognizerSF.create(str(path), "")


@lru_cache(maxsize=4)
def _detector(w: int, h: int) -> cv2.FaceDetectorYN:
    path = settings.models_dir / DET_MODEL
    if not path.exists():
        raise FileNotFoundError(f"Missing {path} — run `py -3.10 scripts/setup.py --only models`")
    return cv2.FaceDetectorYN.create(str(path), "", (w, h), score_threshold=0.8, nms_threshold=0.3, top_k=10)


def detect(frame_bgr: np.ndarray) -> list[Face]:
    h, w = frame_bgr.shape[:2]
    _, rows = _detector(w, h).detect(frame_bgr)
    if rows is None:
        return []
    faces = [
        Face(box=tuple(int(v) for v in r[:4]), score=float(r[14]), landmarks=r[4:14].reshape(5, 2), raw=r)
        for r in rows
    ]
    return sorted(faces, key=lambda f: f.area, reverse=True)


def embed(frame_bgr: np.ndarray, face: Face) -> np.ndarray:
    """L2-normalised 128-d identity embedding."""
    rec = _recognizer()
    aligned = rec.alignCrop(frame_bgr, face.raw)
    feat = rec.feature(aligned).flatten().astype(np.float32)
    return feat / (np.linalg.norm(feat) + 1e-9)


def similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity of two normalised embeddings (SFace same-person ≥ 0.363)."""
    return float(np.dot(a, b))


def sharpness(frame_bgr: np.ndarray, face: Face) -> float:
    x, y, w, h = face.box
    crop = frame_bgr[max(y, 0) : y + h, max(x, 0) : x + w]
    if crop.size == 0:
        return 0.0
    return float(cv2.Laplacian(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var())


def frontalness(face: Face) -> float:
    """1.0 = looking straight at camera. Nose centred between the eyes, eyes level."""
    (rx, ry), (lx, ly), (nx, _), _, _ = face.landmarks
    eye_dist = abs(lx - rx) + 1e-6
    yaw = abs((nx - (rx + lx) / 2) / eye_dist)  # 0 when nose is centred
    roll = abs(ly - ry) / eye_dist
    return float(max(0.0, 1.0 - 2.0 * yaw - roll))
