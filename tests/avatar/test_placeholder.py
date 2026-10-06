import asyncio

import numpy as np

from trackb.avatar.placeholder import _LEVELS, AmplitudeFaceRenderer

SR = 16_000


def _tone(seconds: float, amplitude: int) -> bytes:
    t = np.arange(int(SR * seconds)) / SR
    return (np.sin(2 * np.pi * 220 * t) * amplitude).astype(np.int16).tobytes()


def test_one_frame_per_fps_window_including_partial_last_window() -> None:
    r = AmplitudeFaceRenderer(width=64, height=64, fps=25)
    assert len(r.mouth_levels(_tone(2.0, 8000))) == 50
    assert len(r.mouth_levels(_tone(2.01, 8000))) == 51


def test_mouth_closed_on_silence_and_opens_with_loudness() -> None:
    r = AmplitudeFaceRenderer(width=64, height=64)
    silence = r.mouth_levels(_tone(1.0, 0))
    loud = r.mouth_levels(_tone(1.0, 20000))
    quiet = r.mouth_levels(_tone(1.0, 300))
    assert max(silence) == 0
    assert loud[-1] == _LEVELS - 1
    assert 0 < quiet[-1] < loud[-1]


def test_render_yields_rgba_frames_matching_levels() -> None:
    r = AmplitudeFaceRenderer(width=64, height=48)
    audio = _tone(0.4, 12000)

    async def collect() -> list[np.ndarray]:
        return [f async for f in r.render(audio)]

    frames = asyncio.run(collect())
    assert len(frames) == len(r.mouth_levels(audio))
    assert frames[0].shape == (48, 64, 4) and frames[0].dtype == np.uint8


def test_idle_blinks_periodically() -> None:
    r = AmplitudeFaceRenderer(width=64, height=64, fps=25)
    assert r.idle_frame(0) is r.idle_frame(1)  # blink frames
    assert r.idle_frame(10) is not r.idle_frame(0)  # eyes open
    assert r.idle_frame(100) is r.idle_frame(0)  # next blink 4 s later
