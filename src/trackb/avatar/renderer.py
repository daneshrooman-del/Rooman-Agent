"""What a talking-head renderer must provide.

A renderer turns a clip of the agent's speech (PCM16 mono at `TTS_SAMPLE_RATE`) into video frames
at `fps`: exactly one frame per `1 / fps` seconds of audio, frame *i* showing the face while audio
samples `[i * sr / fps, (i + 1) * sr / fps)` play. `AvatarAVOutput` relies on that 1:1 mapping to
interleave frames with their audio for lip sync. Between replies it shows `idle_frame(i)`.

Implementations: `AmplitudeFaceRenderer` (CPU placeholder, mouth follows loudness) now; a
MuseTalk-backed renderer on the GPU next. `render` is an async iterator so a GPU renderer can
yield frames batch by batch while it's still generating the rest of the clip.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Protocol

import numpy as np
import numpy.typing as npt

Frame = npt.NDArray[np.uint8]
"""One RGBA video frame, shape (height, width, 4)."""


class FaceRenderer(Protocol):
    @property
    def fps(self) -> int: ...

    @property
    def width(self) -> int: ...

    @property
    def height(self) -> int: ...

    def idle_frame(self, index: int) -> Frame:
        """The face while not speaking; `index` lets a renderer animate (blinks, idle motion)."""
        ...

    def render(self, audio_pcm16: bytes) -> AsyncIterator[Frame]:
        """One frame per `1 / fps` s of `audio_pcm16` (the last partial window gets a frame too)."""
        ...
