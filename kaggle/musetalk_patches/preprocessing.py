"""Drop-in replacement for MuseTalk's `musetalk/utils/preprocessing.py` without OpenMMLab.

Upstream gets 68 face landmarks from DWPose via `mmpose` (whole-body keypoints 23:91). The
OpenMMLab stack can't be installed on Kaggle's Python 3.13 (`openmim` itself crashes on the
removed `pkgutil.ImpImporter`, and there are no `mmcv` wheels). This version gets the same
68-point iBUG layout from `face-alignment` (FAN, pure PyTorch) and keeps everything else as
upstream: MuseTalk's vendored S3FD detector for the face box, the same nose-landmark (28/29/30)
bbox logic, `bbox_shift` handling, and the same public names (`get_landmark_and_bbox`,
`get_bbox_range`, `read_imgs`, `resize_landmark`, `coord_placeholder`).

Copy over `MuseTalk/musetalk/utils/preprocessing.py` (the Kaggle notebook does this). It runs
once per avatar during preparation, not per generated frame, so it doesn't affect real-time speed.
"""

import cv2
import face_alignment
import numpy as np
import torch
from face_detection import FaceAlignment, LandmarksType
from tqdm import tqdm

device = "cuda" if torch.cuda.is_available() else "cpu"

# Face box: MuseTalk's vendored S3FD, exactly as upstream.
fa = FaceAlignment(LandmarksType._2D, flip_input=False, device=device)

# 68 landmarks: FAN from the `face-alignment` package (enum renamed _2D -> TWO_D in 1.4).
_lm_type = getattr(face_alignment.LandmarksType, "TWO_D", None) or face_alignment.LandmarksType._2D
landmark_model = face_alignment.FaceAlignment(_lm_type, flip_input=False, device=device)

# marker if the bbox is not sufficient
coord_placeholder = (0.0, 0.0, 0.0, 0.0)


def resize_landmark(landmark, w, h, new_w, new_h):
    landmark_norm = landmark / [w, h]
    return landmark_norm * [new_w, new_h]


def read_imgs(img_list):
    print("reading images...")
    return [cv2.imread(img_path) for img_path in tqdm(img_list)]


def _face_landmarks(frame_bgr, box):
    """68 (x, y) int32 landmarks for the face in `box` (x1, y1, x2, y2), or None."""
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    found = landmark_model.get_landmarks_from_image(rgb, detected_faces=[list(box)])
    if not found:
        return None
    return np.asarray(found[0][:, :2]).astype(np.int32)


def _collect(img_list, upperbondrange):
    frames = read_imgs(img_list)
    if upperbondrange != 0:
        print("get key_landmark and face bounding boxes with the bbox_shift:", upperbondrange)
    else:
        print("get key_landmark and face bounding boxes with the default value")
    coords_list, minus, plus = [], [], []
    for frame in tqdm(frames):
        (box,) = fa.get_detections_for_batch(np.asarray([frame]))
        lm = _face_landmarks(frame, box) if box is not None else None
        if box is None or lm is None:  # no face in the image
            coords_list.append(coord_placeholder)
            continue

        half_face_coord = lm[29].copy()
        minus.append((lm[30] - lm[29])[1])
        plus.append((lm[29] - lm[28])[1])
        if upperbondrange != 0:
            half_face_coord[1] = upperbondrange + half_face_coord[1]  # + moves down, - up
        half_face_dist = np.max(lm[:, 1]) - half_face_coord[1]
        upper_bond = max(0, half_face_coord[1] - half_face_dist)

        f_landmark = (np.min(lm[:, 0]), int(upper_bond), np.max(lm[:, 0]), np.max(lm[:, 1]))
        x1, y1, x2, y2 = f_landmark
        if y2 - y1 <= 0 or x2 - x1 <= 0 or x1 < 0:  # landmark box unusable: reuse the detector's
            coords_list.append(box)
            print("error bbox:", box)
        else:
            coords_list.append(f_landmark)

    def _avg(xs):
        return int(sum(xs) / len(xs)) if xs else 0

    summary = (f"Total frame:「{len(frames)}」 Manually adjust range : "
               f"[ -{_avg(minus)}~{_avg(plus)} ] , the current value: {upperbondrange}")
    return coords_list, frames, summary


def get_bbox_range(img_list, upperbondrange=0):
    return _collect(img_list, upperbondrange)[2]


def get_landmark_and_bbox(img_list, upperbondrange=0):
    coords_list, frames, summary = _collect(img_list, upperbondrange)
    print("*" * 40 + " bbox_shift parameter adjustment " + "*" * 40)
    print(summary)
    print("*" * 113)
    return coords_list, frames
