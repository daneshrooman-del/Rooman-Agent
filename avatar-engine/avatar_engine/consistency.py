"""Stage 4 — consistency guardrail.

Every frame of a generated video is embedded (SFace) and compared against the
twin's identity anchor. The verdict:

  verified  ≥ min_match_ratio of face frames match, few faceless frames
  flagged   mostly the same person, but some frames drifted — returned with the report for review
  rejected  identity lost or face missing too often — generate() raises and the file is quarantined
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path

import cv2
import numpy as np

from . import identity
from .config import settings

REJECT_MATCH_RATIO = 0.80


@dataclass
class ConsistencyReport:
    verdict: str  # verified | flagged | rejected
    frames: int
    checked: int
    faceless_ratio: float
    match_ratio: float
    median_similarity: float
    min_similarity: float
    threshold: float
    drifted_segments: list[dict] = field(default_factory=list)  # [{start_s, end_s, min_similarity}]
    reason: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


def check_video(video: Path, anchor: np.ndarray, stride: int = 1) -> ConsistencyReport:
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    thr = settings.identity_threshold
    sims: list[float | None] = []
    idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if idx % stride == 0:
            faces = identity.detect(frame)
            sims.append(identity.similarity(identity.embed(frame, faces[0]), anchor) if faces else None)
        idx += 1
    cap.release()

    if not sims:
        return ConsistencyReport("rejected", idx, 0, 1.0, 0.0, 0.0, 0.0, thr, reason="Video has no readable frames.")

    faced = [s for s in sims if s is not None]
    faceless_ratio = 1 - len(faced) / len(sims)
    match_ratio = (sum(s >= thr for s in faced) / len(faced)) if faced else 0.0

    # contiguous runs of drifted (or faceless) frames
    segments, start, low = [], None, 1.0
    for i, s in enumerate(sims + [thr]):  # sentinel closes a trailing run
        bad = s is None or s < thr
        if bad and start is None:
            start, low = i, 1.0
        if bad:
            low = min(low, s if s is not None else 0.0)
        elif start is not None:
            segments.append({"start_s": round(start * stride / fps, 2), "end_s": round(i * stride / fps, 2), "min_similarity": round(low, 3)})
            start = None

    if not faced or faceless_ratio > settings.max_faceless_ratio or match_ratio < REJECT_MATCH_RATIO:
        verdict = "rejected"
        reason = "No face detected." if not faced else f"Only {match_ratio:.0%} of frames match the twin ({faceless_ratio:.0%} faceless)."
    elif match_ratio < settings.min_match_ratio:
        verdict, reason = "flagged", f"{len(segments)} segment(s) drifted below similarity {thr}."
    else:
        verdict, reason = "verified", "Same identity as the reference twin."

    return ConsistencyReport(
        verdict=verdict,
        frames=idx,
        checked=len(sims),
        faceless_ratio=round(faceless_ratio, 4),
        match_ratio=round(match_ratio, 4),
        median_similarity=round(float(np.median(faced)), 4) if faced else 0.0,
        min_similarity=round(float(min(faced)), 4) if faced else 0.0,
        threshold=thr,
        drifted_segments=segments,
        reason=reason,
    )
