# Avatar Engine — Track A

Turns a person's reference video into a reusable **digital twin**, then generates new videos of that same person performing actions on command. Every generated frame is checked against the twin's identity.

## The interface (stable — Tracks B and C call this)

```python
from avatar_engine import create_avatar, generate

avatar_id = create_avatar("me.mp4")                              # -> "av_3f9a…"
video = generate(avatar_id, "Welcome to Rooman!", "talk")        # -> Path to .mp4
video = generate(avatar_id, "speech.wav", "talk")                # drive with your own audio
video = generate(avatar_id, "", "greet")                         # greeting with a default line
```

| | |
|---|---|
| `create_avatar(video_file) -> avatar_id` | Blocks until training finishes. Raises `IngestError` (unusable footage; the message is user-facing) or `WorkerError` (a model failed). |
| `generate(avatar_id, script_or_audio, action_type) -> video_file` | `script_or_audio` is text (spoken in the cloned voice) or a path to an audio file. Writes `<video>.consistency.json` next to the MP4. Raises `ConsistencyError` if identity drifted (the file is quarantined in `data/outputs/rejected/`), `ActionNotSupported`, `AvatarNotReady` or `AvatarNotFound`. |

Optional keyword-only extras (safe to ignore): `language="en"`, `out_path=…`, `on_progress=callback(stage_index, message)`, plus `get_avatar(avatar_id)` for status. The two positional signatures are locked by `tests/test_interface.py`.

### Action support

| action_type | Status | How |
|---|---|---|
| `talk` | ✅ | Audio-driven face animation, using the person's **own head motion and blinks** from their reference video |
| `greet` | ✅ | More expressive animation; default line if the script is empty |
| `gesture`, `walk`, `demonstrate` | ❌ raises `ActionNotSupported` | These need full-body motion. SadTalker animates the face and head only. The slot is in `actions.py`, ready for a body-motion model (e.g. MimicMotion or Wan-Animate) once a ≥24 GB GPU is available. |

### HTTP API (for the web app)

`avatar-engine serve --port 8100`

| Method and path | Purpose |
| --- | --- |
| `POST /avatars` (multipart `video`, `consent=true`) | Start training → `202 {avatar_id}` |
| `GET /avatars/{id}` | Status, stage and warnings |
| `GET /avatars/{id}/reference` | The twin's reference frame |
| `POST /avatars/{id}/generate` (form `action_type`, `language`, and `script` or an `audio` file) | Start a render → `202 {job_id}`; add `?wait=true` to stream the MP4 back instead |
| `GET /jobs/{job_id}` | Progress and the consistency report |
| `GET /jobs/{job_id}/video` | The finished MP4 |

## Providers: Tavus (hosted, no GPU) or local

Set by `AVATAR_ENGINE_PROVIDER`. It defaults to **`tavus`** when `TAVUS_API_KEY` is present in `avatar-engine/.env`, which is git-ignored and must never be committed.

| | `tavus` (default with a key) | `local` |
|---|---|---|
| Face and voice model | Tavus Phoenix-4.5 (face and voice learned from the recording) | SadTalker + XTTS-v2 |
| Hardware | None; a normal laptop works | NVIDIA GPU recommended |
| Recording | **About 1 minute: 30 s speaking, then 30 s still, lips closed.** 1080p, 25+ fps | 6 s or more; 1–3 min is best |
| Output | 1080p | Original frame size, 256 px face |
| Cost | Tavus credits per generated minute | Free (your electricity) |

**How the training video reaches Tavus.** Tavus only trains from a public URL. The engine serves the file from this machine through a **Cloudflare quick tunnel** (`publish.py`), which is free and needs no account.
- Each file gets a random 128-bit token path that expires in 24 hours and is revoked once Tavus has trained.
- Unknown or expired tokens return 404.
- Keep the PC online while training runs.
- In production, set `AVATAR_ENGINE_PUBLIC_URL` to your own domain, or switch to presigned S3 links.

Tavus videos still pass through our per-frame **identity check** against an anchor computed from your own recording.

Phoenix-4.5 faces are usable within minutes. They carry a preview watermark until Tavus finishes background tuning, which takes a few hours.

## Pipeline (local provider)

1. **Ingestion** (`ingest.py`)
   - Validates the footage: a video stream, audio, enough length, one person.
   - Extracts clean speech with ffmpeg (high-pass, FFT denoise, loudness normalisation).
   - Gets per-frame landmarks: face box and 5 points (YuNet), a 468-point face mesh and a 33-point body pose (MediaPipe).
   - Segments the person from the background (MediaPipe) and builds a clean background plate.
2. **Twin training** (`twin.py`)
   - Picks the sharpest, most frontal frame as the reference.
   - Builds an identity anchor: the mean SFace embedding of the 15 best frames, spread over time.
   - Takes a 5 s clip of the person's natural head motion.
   - Clones the voice: XTTS-v2 speaker latents.
   - Fits SadTalker's 3D face model once and caches it for every later render.
3. **Generation** (`generate.py`, `actions.py`): script → XTTS-v2 speech in the cloned voice → SadTalker renders into the original frame → the full-quality speech is muxed back in.
4. **Consistency check** (`consistency.py`)
   - Embeds every frame and compares it with the anchor; the same-person threshold is SFace cosine ≥ 0.363.
   - **verified**: at least 95% of frames match.
   - **flagged**: returned with the drifted time ranges listed.
   - **rejected**: fewer than 80% match, or more than 10% of frames have no face. `ConsistencyError` is raised.

Each heavy model runs in its **own virtualenv as a worker process** (`workers/`). The libraries need incompatible versions, and a fresh process frees GPU memory between steps. That's required on 4 GB GPUs.

## Setup

Needs Python 3.10 and git. An NVIDIA GPU is optional; CPU works but is slow.

```bash
py -3.10 scripts/setup.py                          # 3 venvs + all checkpoints (~6 GB)
set AVATAR_ENGINE_ACCEPT_COQUI_CPML=1              # Windows (export … on Linux): required to load XTTS-v2 — see Licensing
.venvs/engine/Scripts/python -m pytest            # fast tests (Linux: .venvs/engine/bin/python)
.venvs/engine/Scripts/python -m pytest -m e2e -s  # full pipeline on the bundled sample video
.venvs/engine/Scripts/avatar-engine create my_video.mp4
```

Tested on a GTX 1650 (4 GB) with 8 GB RAM. SadTalker renders at 256 px face resolution (`AVATAR_ENGINE_*` env vars in `config.py` tune paths and thresholds).

**Recording tips for users:** 1–3 minutes, one person, face the camera, even lighting, quiet room, talk naturally.

## ⚠️ Licensing — read before any commercial use

| Component | License | Commercial use |
|---|---|---|
| SadTalker code and weights | Apache-2.0 | ✅ |
| OpenCV YuNet / SFace | Apache-2.0 | ✅ |
| MediaPipe | Apache-2.0 | ✅ |
| GFPGAN / facexlib weights (bundled with SadTalker setup) | Apache-2.0 / MIT | ✅ |
| **Coqui XTTS-v2 weights** | **Coqui Public Model License** | ❌ **non-commercial only** |

XTTS-v2 was chosen per the Track A brief. Before any paid or customer-facing launch, swap the voice worker for a commercially licensed option, such as OpenVoice V2 (MIT), CosyVoice 2 (Apache-2.0) or a paid API. Only `workers/xtts_worker.py` changes; the interface stays the same.
