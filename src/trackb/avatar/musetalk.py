"""`FaceRenderer` backed by MuseTalk 1.5: real lip-sync on the GPU, across one or more GPUs.

Measured on a Kaggle T4 (changelog 015): MuseTalk's own real-time script is **GPU-bound at
12 fps** per GPU (UNet + VAE decode busy 124.8 s of 125.3 s for 1500 frames) while its CPU
blending runs at 49 fps. Real time needs 25 fps. So this renderer:

- runs one model copy per GPU (`devices`) and sends frame batches to them round-robin, in
  parallel (PyTorch releases the GIL during kernels), yielding frames strictly in order;
- can decode with TAESD (`decoder="taesd"`), a tiny decoder for the same SD latents, instead of
  the full SD VAE decoder;
- yields frames as each batch finishes, so time-to-first-frame is one batch, not the whole clip;
- crops the output to a square around the head (`output_size`) instead of streaming the whole
  704x1216 portrait frame.

The avatar must already be prepared by MuseTalk (its `realtime_inference.py` with
`preparation: True` writes `results/v15/avatars/<id>/`: `latents.pt`, `coords.pkl`,
`full_imgs/`, `mask/`, `mask_coords.pkl`). Preparation runs once per avatar.

MuseTalk is imported from a checkout (`musetalk_dir`) at construction time, so this module
imports nothing heavy until a renderer is actually built. The model work sits behind small
`_Engine` objects (one per GPU) and a features function, so the batching/ordering logic here is
unit-tested with fakes; the MuseTalk calls themselves are exercised by the Kaggle notebook.
"""

from __future__ import annotations

import asyncio
import glob
import math
import os
import pickle
import sys
from collections.abc import AsyncIterator, Callable, Sequence
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Protocol

import numpy as np

from trackb.avatar.renderer import Frame
from trackb.tts.base import TTS_SAMPLE_RATE

FACE_SIZE = 256  # MuseTalk generates 256x256 faces
_AUDIO_FPS = 50  # Whisper encoder frames per second
_PAD_LEFT = _PAD_RIGHT = 2  # MuseTalk defaults (audio_padding_length_left/right)


class Engine(Protocol):
    """One GPU's model copy: (whisper chunks, latents) -> generated faces, (B, 256, 256, 3) BGR."""

    def generate(self, whisper_batch: Any, latent_batch: Any) -> np.ndarray: ...


FeaturesFn = Callable[[np.ndarray, int], Sequence[Any]]
"""(float32 mono audio at 16 kHz, fps) -> one Whisper feature chunk per video frame."""


def head_crop_box(
    coords: Sequence[Sequence[float]], frame_w: int, frame_h: int, expand: float = 2.2
) -> tuple[int, int, int, int]:
    """One fixed square (x1, y1, x2, y2) around every face box, `expand` x the largest face, kept
    inside the frame. Fixed across frames so the head doesn't jitter in the output."""
    boxes = np.array([c for c in coords if any(c)], dtype=np.float64)
    if boxes.size == 0:
        side = min(frame_w, frame_h)
        return (0, 0, side, side)
    cx = (boxes[:, 0].min() + boxes[:, 2].max()) / 2
    cy = (boxes[:, 1].min() + boxes[:, 3].max()) / 2
    face = max((boxes[:, 2] - boxes[:, 0]).max(), (boxes[:, 3] - boxes[:, 1]).max())
    side = int(min(face * expand, frame_w, frame_h))
    x1 = int(np.clip(cx - side / 2, 0, frame_w - side))
    y1 = int(np.clip(cy - side / 2, 0, frame_h - side))
    return (x1, y1, x1 + side, y1 + side)


class MuseTalkRenderer:
    def __init__(
        self,
        *,
        frames: Sequence[np.ndarray],
        coords: Sequence[Sequence[int]],
        masks: Sequence[np.ndarray],
        mask_coords: Sequence[Sequence[int]],
        latents: Sequence[Any],
        engines: Sequence[Engine],
        features_fn: FeaturesFn,
        blend_fn: Callable[..., np.ndarray],
        fps: int = 25,
        batch_size: int = 8,
        output_size: int = 512,
        stack_fn: Callable[[Sequence[Any]], Any] | None = None,
        cat_fn: Callable[[Sequence[Any]], Any] | None = None,
        blend_workers: int = 3,
        lookahead: int = 2,
    ) -> None:
        """Prefer `MuseTalkRenderer.load(...)`; this constructor takes already-loaded parts so the
        orchestration can be tested without MuseTalk. `frames` etc. are MuseTalk's *cycle* lists
        (forward + reversed, as its preparation saves them)."""
        if not engines:
            raise ValueError("need at least one engine")
        self._frames, self._coords = list(frames), list(coords)
        self._masks, self._mask_coords = list(masks), list(mask_coords)
        self._latents = list(latents)
        self._engines = list(engines)
        self._features_fn = features_fn
        self._blend_fn = blend_fn
        self._fps, self._batch_size, self._out = fps, batch_size, output_size
        self._stack = stack_fn or _torch_stack
        self._cat = cat_fn or _torch_cat
        self._samples_per_frame = TTS_SAMPLE_RATE // fps
        h, w = self._frames[0].shape[:2]
        self._crop = head_crop_box(self._coords, w, h)
        self._lookahead = lookahead
        self._cursor = 0  # avatar frame index; continues across clips so body motion is smooth
        # One thread per GPU (each engine's kernels run while the others are busy) + blenders.
        self._gpu_pool = ThreadPoolExecutor(
            max_workers=len(self._engines), thread_name_prefix="mt-gpu"
        )
        self._blend_pool = ThreadPoolExecutor(
            max_workers=blend_workers, thread_name_prefix="mt-blend"
        )

    # -- FaceRenderer ------------------------------------------------------------------------

    @property
    def fps(self) -> int:
        return self._fps

    @property
    def width(self) -> int:
        return self._out

    @property
    def height(self) -> int:
        return self._out

    def idle_frame(self, index: int) -> Frame:
        return self._finish(self._frames[index % len(self._frames)])

    async def render(self, audio_pcm16: bytes) -> AsyncIterator[Frame]:
        samples = np.frombuffer(audio_pcm16, dtype=np.int16).astype(np.float32) / 32768.0
        want = -(-len(samples) // self._samples_per_frame)  # FaceRenderer contract: ceil
        if want == 0:
            return
        loop = asyncio.get_running_loop()
        chunks = list(
            await loop.run_in_executor(self._gpu_pool, self._features_fn, samples, self._fps)
        )
        # MuseTalk yields floor(duration * fps) chunks; repeat the last for the partial window.
        if not chunks:
            return
        chunks += [chunks[-1]] * max(0, want - len(chunks))
        chunks = chunks[:want]

        start = self._cursor
        self._cursor += want
        batches = [
            list(range(i, min(i + self._batch_size, want)))
            for i in range(0, want, self._batch_size)
        ]

        def generate(batch_no: int) -> list[tuple[int, np.ndarray]]:
            idxs = batches[batch_no]
            engine = self._engines[batch_no % len(self._engines)]
            whisper_batch = self._stack([chunks[i] for i in idxs])
            latent_batch = self._cat(
                [self._latents[(start + i) % len(self._latents)] for i in idxs]
            )
            return list(zip(idxs, engine.generate(whisper_batch, latent_batch), strict=True))

        # Batches run on the GPUs ahead of playback (`_lookahead` per GPU) while earlier ones are
        # blended on the CPU pool; frames are yielded strictly in order. Production is paced by
        # the consumer (AvatarAVOutput pushes in real time), so the lookahead bounds memory.
        ahead = len(self._engines) * self._lookahead
        in_flight: dict[int, asyncio.Future[list[tuple[int, np.ndarray]]]] = {}
        submitted = 0
        for batch_no in range(len(batches)):
            while submitted < len(batches) and submitted < batch_no + ahead:
                in_flight[submitted] = loop.run_in_executor(self._gpu_pool, generate, submitted)
                submitted += 1
            faces = await in_flight.pop(batch_no)
            composed = [
                loop.run_in_executor(self._blend_pool, self._compose, start + i, face)
                for i, face in faces
            ]
            for frame in await asyncio.gather(*composed):
                yield frame

    def close(self) -> None:
        self._gpu_pool.shutdown(wait=False, cancel_futures=True)
        self._blend_pool.shutdown(wait=False, cancel_futures=True)

    # -- internals ---------------------------------------------------------------------------

    def _compose(self, index: int, face_bgr: np.ndarray) -> Frame:
        """Paste one generated 256x256 face into its avatar frame (MuseTalk's own blending),
        then crop/resize to the output square."""
        import cv2

        n = len(self._frames)
        i = index % n
        x1, y1, x2, y2 = (int(v) for v in self._coords[i])
        face = cv2.resize(face_bgr.astype(np.uint8), (x2 - x1, y2 - y1))
        full = self._blend_fn(
            self._frames[i], face, [x1, y1, x2, y2], self._masks[i], self._mask_coords[i]
        )
        return self._finish(full)

    def _finish(self, frame_bgr: np.ndarray) -> Frame:
        import cv2

        x1, y1, x2, y2 = self._crop
        square = cv2.resize(
            frame_bgr[y1:y2, x1:x2], (self._out, self._out), interpolation=cv2.INTER_AREA
        )
        return cv2.cvtColor(square, cv2.COLOR_BGR2RGBA)

    # -- construction from a MuseTalk checkout -------------------------------------------------

    @classmethod
    def load(
        cls,
        *,
        musetalk_dir: str,
        avatar_dir: str,
        devices: Sequence[str] = ("cuda:0",),
        decoder: str = "sd-vae",
        fps: int = 25,
        batch_size: int = 8,
        output_size: int = 512,
    ) -> MuseTalkRenderer:
        import cv2
        import torch

        if musetalk_dir not in sys.path:
            sys.path.insert(0, musetalk_dir)
        from musetalk.utils.audio_processor import AudioProcessor
        from musetalk.utils.blending import get_image_blending
        from transformers import WhisperModel

        models = os.path.join(musetalk_dir, "models")
        engines = [_MuseTalkEngine(models, device, decoder) for device in devices]
        dtype = torch.float16
        main = torch.device(devices[0])
        audio_processor = AudioProcessor(feature_extractor_path=os.path.join(models, "whisper"))
        whisper = WhisperModel.from_pretrained(os.path.join(models, "whisper"))
        whisper = whisper.to(device=main, dtype=dtype).eval().requires_grad_(False)

        @torch.no_grad()
        def features(samples: np.ndarray, fps: int) -> Sequence[Any]:
            # MuseTalk's get_audio_feature reads a wav file; this is the same on an array.
            seg = 30 * TTS_SAMPLE_RATE
            feats = [
                audio_processor.feature_extractor(
                    samples[i : i + seg], return_tensors="pt", sampling_rate=TTS_SAMPLE_RATE
                ).input_features.to(dtype=dtype)
                for i in range(0, len(samples), seg)
            ]
            prompts = audio_processor.get_whisper_chunk(
                feats,
                main,
                dtype,
                whisper,
                len(samples),
                fps=fps,
                audio_padding_length_left=_PAD_LEFT,
                audio_padding_length_right=_PAD_RIGHT,
            )
            return list(prompts)

        def read(pattern: str) -> list[np.ndarray]:
            paths = sorted(
                glob.glob(pattern), key=lambda p: int(os.path.splitext(os.path.basename(p))[0])
            )
            return [cv2.imread(p) for p in paths]

        with open(os.path.join(avatar_dir, "coords.pkl"), "rb") as f:
            coords = pickle.load(f)
        with open(os.path.join(avatar_dir, "mask_coords.pkl"), "rb") as f:
            mask_coords = pickle.load(f)
        latents = torch.load(os.path.join(avatar_dir, "latents.pt"), map_location="cpu")

        return cls(
            frames=read(os.path.join(avatar_dir, "full_imgs", "*.png")),
            coords=coords,
            masks=read(os.path.join(avatar_dir, "mask", "*.png")),
            mask_coords=mask_coords,
            latents=latents,
            engines=engines,
            features_fn=features,
            blend_fn=get_image_blending,
            fps=fps,
            batch_size=batch_size,
            output_size=output_size,
        )


class _MuseTalkEngine:
    """MuseTalk's UNet + positional encoding + a decoder, fp16, pinned to one GPU."""

    def __init__(self, models_dir: str, device: str, decoder: str) -> None:
        import torch
        from musetalk.models.unet import PositionalEncoding, UNet

        self.device = torch.device(device)
        self.unet = UNet(
            unet_config=os.path.join(models_dir, "musetalkV15", "musetalk.json"),
            model_path=os.path.join(models_dir, "musetalkV15", "unet.pth"),
            device=self.device,
        )
        self.unet.model = self.unet.model.half().to(self.device)
        self.pe = PositionalEncoding(d_model=384).half().to(self.device)
        self.timesteps = torch.tensor([0], device=self.device)
        self.decoder = decoder
        if decoder == "taesd":
            from diffusers import AutoencoderTiny

            # TAESD decodes SD's *scaled* latents directly (no 1/scaling_factor), output in [-1, 1].
            self.vae = AutoencoderTiny.from_pretrained(
                "madebyollin/taesd", torch_dtype=torch.float16
            )
            self.scale = 1.0
        elif decoder == "sd-vae":
            from diffusers import AutoencoderKL

            # MuseTalk's VAE class hard-codes device "cuda" (= GPU 0); load the same weights here
            # so each engine's decoder lives on its own GPU.
            self.vae = AutoencoderKL.from_pretrained(
                os.path.join(models_dir, "sd-vae"), torch_dtype=torch.float16
            )
            self.scale = 1.0 / self.vae.config.scaling_factor
        else:
            raise ValueError(f"unknown decoder {decoder!r} (sd-vae | taesd)")
        self.vae = self.vae.to(self.device).eval()

    def generate(self, whisper_batch: Any, latent_batch: Any) -> np.ndarray:
        import torch

        with torch.no_grad():
            audio = self.pe(whisper_batch.to(self.device, dtype=torch.float16))
            latents = latent_batch.to(self.device, dtype=torch.float16)
            pred = self.unet.model(latents, self.timesteps, encoder_hidden_states=audio).sample
            image = self.vae.decode(pred * self.scale).sample
            image = (image / 2 + 0.5).clamp(0, 1).permute(0, 2, 3, 1).float().cpu().numpy()
        return (image * 255).round().astype(np.uint8)[..., ::-1]  # RGB -> BGR, as MuseTalk


def _torch_stack(items: Sequence[Any]) -> Any:
    import torch

    return torch.stack(list(items))


def _torch_cat(items: Sequence[Any]) -> Any:
    import torch

    return torch.cat(list(items), dim=0)


def frames_for(duration_s: float, fps: int) -> int:
    """How many frames MuseTalk itself produces for a clip (floor), for reference/tests."""
    return math.floor(duration_s * fps)
