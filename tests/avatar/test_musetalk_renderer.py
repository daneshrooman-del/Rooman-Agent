"""Orchestration tests for MuseTalkRenderer with fake GPU engines (no MuseTalk, no GPU)."""

import random
import threading
import time

import numpy as np
import pytest

from trackb.avatar.musetalk import MuseTalkRenderer, head_crop_box

SR = 16_000
FPS = 25
N_AVATAR = 10  # avatar cycle length
H, W = 48, 64


class _Engine:
    """Fake GPU: face pixel value = latent id + 100 * whisper chunk id (both encode indices)."""

    def __init__(self, name: str, jitter: float = 0.0) -> None:
        self.name = name
        self.batches: list[list[int]] = []
        self.jitter = jitter
        self.threads: set[str] = set()

    def generate(self, whisper_batch: np.ndarray, latent_batch: np.ndarray) -> np.ndarray:
        self.threads.add(threading.current_thread().name)
        self.batches.append([int(w[0]) for w in whisper_batch])
        time.sleep(random.uniform(0, self.jitter))
        out = np.zeros((len(whisper_batch), 256, 256, 3), dtype=np.uint8)
        for k, (w, lat) in enumerate(zip(whisper_batch, latent_batch, strict=True)):
            out[k, ..., 0] = int(lat[0])  # which avatar frame's latent
            out[k, ..., 1] = int(w[0]) % 256  # which audio chunk
        return out


def _blend(frame, face, box, mask, mask_box):
    # Fake MuseTalk blending: whole frame takes the face's encoded values.
    out = frame.copy()
    out[..., 0] = face[0, 0, 0]
    out[..., 1] = face[0, 0, 1]
    return out


def _renderer(engines, *, batch_size=4, output_size=32) -> MuseTalkRenderer:
    frames = [np.full((H, W, 3), 200, dtype=np.uint8) for _ in range(N_AVATAR)]
    coords = [(20, 10, 44, 34)] * N_AVATAR
    return MuseTalkRenderer(
        frames=frames,
        coords=coords,
        masks=[np.zeros((H, W), dtype=np.uint8)] * N_AVATAR,
        mask_coords=[(0, 0, W, H)] * N_AVATAR,
        latents=[np.array([[i]]) for i in range(N_AVATAR)],
        engines=engines,
        # MuseTalk produces floor(duration * fps) chunks; chunk i is encoded as [i].
        features_fn=lambda samples, fps: [np.array([i]) for i in range(len(samples) * fps // SR)],
        blend_fn=_blend,
        fps=FPS,
        batch_size=batch_size,
        output_size=output_size,
        stack_fn=lambda xs: np.stack(xs),
        cat_fn=lambda xs: np.concatenate(xs, axis=0),
    )


def _audio(seconds: float) -> bytes:
    return np.zeros(int(SR * seconds), dtype=np.int16).tobytes()


async def _collect(r: MuseTalkRenderer, audio: bytes) -> list[np.ndarray]:
    return [f async for f in r.render(audio)]


@pytest.mark.asyncio
async def test_frame_count_follows_renderer_contract_and_pads_partial_window() -> None:
    r = _renderer([_Engine("gpu0")])
    frames = await _collect(r, _audio(1.0) + b"\x00\x00" * 100)  # 1 s + a partial window
    assert len(frames) == 26
    assert frames[0].shape == (32, 32, 4) and frames[0].dtype == np.uint8
    # The padded 26th frame reuses the last audio chunk (24), RGBA channel order: B,G,R -> R,G,B
    assert frames[-1][0, 0, 1] == frames[-2][0, 0, 1] == 24
    assert await _collect(r, b"") == []


@pytest.mark.asyncio
async def test_two_gpus_alternate_batches_and_frames_stay_in_order() -> None:
    random.seed(1)
    gpu0, gpu1 = _Engine("gpu0", jitter=0.02), _Engine("gpu1", jitter=0.02)
    r = _renderer([gpu0, gpu1], batch_size=4)

    frames = await _collect(r, _audio(1.2))  # 30 frames -> 8 batches

    assert [int(f[0, 0, 1]) for f in frames] == list(range(30))  # audio chunk order preserved
    assert gpu0.batches == [[0, 1, 2, 3], [8, 9, 10, 11], [16, 17, 18, 19], [24, 25, 26, 27]]
    assert gpu1.batches == [[4, 5, 6, 7], [12, 13, 14, 15], [20, 21, 22, 23], [28, 29]]
    r.close()


@pytest.mark.asyncio
async def test_avatar_motion_continues_across_clips() -> None:
    r = _renderer([_Engine("gpu0")])
    first = await _collect(r, _audio(0.24))  # 6 frames: avatar frames 0..5
    second = await _collect(r, _audio(0.24))  # continues at 6..9, then wraps to 0, 1
    # Output channel 2 (B in RGBA order) carries the latent id = avatar frame index.
    assert [int(f[0, 0, 2]) for f in first] == [0, 1, 2, 3, 4, 5]
    assert [int(f[0, 0, 2]) for f in second] == [6, 7, 8, 9, 0, 1]


@pytest.mark.asyncio
async def test_engines_run_concurrently_on_separate_threads() -> None:
    class _Slow(_Engine):
        def generate(self, w, lat):  # type: ignore[override]
            time.sleep(0.2)
            return super().generate(w, lat)

    r = _renderer([_Slow("a"), _Slow("b")], batch_size=4)
    started = time.perf_counter()
    await _collect(r, _audio(0.32))  # 8 frames = 2 batches, one per engine
    assert time.perf_counter() - started < 0.35  # ~0.2 s if parallel, ~0.4 s if serial


def test_idle_frame_and_head_crop() -> None:
    r = _renderer([_Engine("gpu0")], output_size=40)
    assert r.idle_frame(123).shape == (40, 40, 4)
    assert (r.width, r.height, r.fps) == (40, 40, FPS)

    box = head_crop_box([(300, 400, 500, 620), (0, 0, 0, 0), (310, 410, 510, 630)], 704, 1216)
    x1, y1, x2, y2 = box
    assert x2 - x1 == y2 - y1  # square
    assert 0 <= x1 and x2 <= 704 and 0 <= y1 and y2 <= 1216
    assert x1 <= 300 and x2 >= 510 and y1 <= 400 and y2 >= 630  # contains every face
    assert head_crop_box([(0, 0, 0, 0)], 100, 80) == (0, 0, 80, 80)  # no faces: safe default


def test_needs_an_engine() -> None:
    with pytest.raises(ValueError, match="engine"):
        _renderer([])
