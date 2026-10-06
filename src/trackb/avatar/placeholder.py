"""A CPU-only placeholder face whose mouth opens with the loudness of the speech.

Not a lip-sync model: it exists so the whole video path (renderer → A/V sync → LiveKit video
track → browser) can be built and tested on any machine, and as a fallback when no GPU renderer
is available. Pure numpy; the face is drawn once and mouth shapes are cached per openness level,
so a frame costs a dictionary lookup.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import numpy as np

from trackb.avatar.renderer import Frame
from trackb.tts.base import TTS_SAMPLE_RATE

_LEVELS = 12
_SILENCE_DB = -50.0
_LOUD_DB = -15.0


def _ellipse_mask(h: int, w: int, cy: float, cx: float, ry: float, rx: float) -> np.ndarray:
    yy, xx = np.ogrid[:h, :w]
    return ((yy - cy) / max(ry, 1e-6)) ** 2 + ((xx - cx) / max(rx, 1e-6)) ** 2 <= 1.0


class AmplitudeFaceRenderer:
    def __init__(
        self,
        *,
        width: int = 480,
        height: int = 480,
        fps: int = 25,
        sample_rate: int = TTS_SAMPLE_RATE,
        attack: float = 0.6,
        release: float = 0.35,
    ) -> None:
        self._w, self._h, self._fps = width, height, fps
        self._samples_per_frame = sample_rate // fps
        self._attack, self._release = attack, release
        self._base = self._draw_base()
        self._mouths = [self._draw_mouth(level / (_LEVELS - 1)) for level in range(_LEVELS)]
        self._blink = self._draw_blink()

    @property
    def fps(self) -> int:
        return self._fps

    @property
    def width(self) -> int:
        return self._w

    @property
    def height(self) -> int:
        return self._h

    def idle_frame(self, index: int) -> Frame:
        # Blink for 3 frames every ~4 s so an idle avatar doesn't look frozen.
        if index % (self._fps * 4) < 3:
            return self._blink
        return self._mouths[0]

    async def render(self, audio_pcm16: bytes) -> AsyncIterator[Frame]:
        for level in self.mouth_levels(audio_pcm16):
            yield self._mouths[level]

    def mouth_levels(self, audio_pcm16: bytes) -> list[int]:
        """Quantized mouth openness (0 .. _LEVELS-1) per video frame, smoothed over time."""
        samples = np.frombuffer(audio_pcm16, dtype=np.int16).astype(np.float32) / 32768.0
        n_frames = -(-len(samples) // self._samples_per_frame)  # ceil
        levels: list[int] = []
        openness = 0.0
        for i in range(n_frames):
            window = samples[i * self._samples_per_frame : (i + 1) * self._samples_per_frame]
            rms = float(np.sqrt(np.mean(window**2))) if window.size else 0.0
            db = 20.0 * np.log10(rms + 1e-9)
            target = float(np.clip((db - _SILENCE_DB) / (_LOUD_DB - _SILENCE_DB), 0.0, 1.0))
            rate = self._attack if target > openness else self._release
            openness += (target - openness) * rate
            levels.append(round(openness * (_LEVELS - 1)))
        return levels

    def _draw_base(self) -> Frame:
        h, w = self._h, self._w
        img = np.zeros((h, w, 4), dtype=np.uint8)
        img[..., :3] = (24, 28, 38)
        img[..., 3] = 255
        img[_ellipse_mask(h, w, h * 0.5, w * 0.5, h * 0.38, w * 0.3)] = (226, 189, 160, 255)
        return img

    def _with_eyes(self, img: Frame, open_eyes: bool) -> Frame:
        h, w = self._h, self._w
        for cx in (w * 0.39, w * 0.61):
            ry = h * 0.035 if open_eyes else h * 0.006
            img[_ellipse_mask(h, w, h * 0.42, cx, ry, w * 0.035)] = (40, 40, 48, 255)
        return img

    def _draw_mouth(self, openness: float) -> Frame:
        h, w = self._h, self._w
        img = self._with_eyes(self._base.copy(), open_eyes=True)
        ry = h * (0.008 + 0.06 * openness)
        img[_ellipse_mask(h, w, h * 0.66, w * 0.5, ry, w * (0.09 - 0.015 * openness))] = (
            120, 40, 48, 255,
        )
        return img

    def _draw_blink(self) -> Frame:
        img = self._with_eyes(self._base.copy(), open_eyes=False)
        mouth = _ellipse_mask(self._h, self._w, self._h * 0.66, self._w * 0.5,
                              self._h * 0.008, self._w * 0.09)
        img[mouth] = (120, 40, 48, 255)
        return img
