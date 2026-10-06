# 016 — Step 5b: agent video track with lip sync (placeholder renderer)

**Plan step:** 5b (stream rendered video over WebRTC, synced with the TTS audio)

Built while waiting for the MuseTalk profile numbers: whichever way MuseTalk gets faster, it
needs this path. MuseTalk will be one more `FaceRenderer`.

## What we did
- New package `trackb/avatar/`:
  - `renderer.py` — `FaceRenderer` protocol: one RGBA frame per `1/fps` s of speech audio
    (async iterator, so a GPU renderer can stream batches), plus `idle_frame(i)`.
  - `placeholder.py` — `AmplitudeFaceRenderer`: CPU/numpy face whose mouth opens with loudness
    (12 cached mouth shapes, smoothed attack/release, blink every ~4 s). Not lip-sync AI; it's the
    test vehicle for the video path and a fallback when no GPU renderer is available.
  - `output.py` — `AvatarAVOutput`: speech goes through `rtc.AVSynchronizer`, pushing each frame
    followed by its 40 ms of audio. Audio and video queues are both kept at 100 ms (LiveKit's
    default 1 s audio queue would let the voice lead the face). Idle frames bypass the
    synchronizer on their own 25 fps timer (queued idle frames would delay each reply's video vs
    its audio) and resume only after a reply has fully played out, so back-to-back sentences
    aren't split by idle frames. `clear()` is there for barge-in.
- `LiveKitRoomClient(avatar=...)`: `start_media()` publishes the audio track and a camera-source
  video track at session start (face visible before the first reply) and starts the idle loop;
  `publish_audio` routes speech through the avatar; `disconnect` closes it. `SessionWorker.join`
  calls `start_media` when the room client has it.
- Setting `TRACKB_AVATAR_RENDERER` = `none` (default, unchanged behaviour) | `placeholder`;
  `TRACKB_AVATAR_FPS` (25). Kaggle worker notebook sets `placeholder`.
- `dev/voice-test.html` shows the agent's video above the transcript.

## Measured
| Test | Result |
|---|---|
| Frames handed to LiveKit by `AvatarAVOutput` | **24.9–25.0 fps** |
| Received, **local** LiveKit server (no internet in the path) | **20 fps, 480×480**, max gap 88–108 ms |
| Received via **LiveKit Cloud** from this PC | 0.4–11 fps, downscaled to 360×360 |
| **Lip sync** (mouth openness vs received audio loudness, cross-correlation, 2 sessions) | **−10 ms / 0 ms** lag, corr 0.61–0.64 |
| Typed message → first agent audio (local server, Gemini) | 2.6–3.0 s |

Reading: our code delivers 25 fps; the drop over Cloud is this PC's uplink (WebRTC bandwidth
estimation cuts resolution and frame rate), and the remaining 20-vs-25 locally is this 2012 CPU
encoding and decoding in one process. A worker on Kaggle (datacenter network, modern CPU) is the
real test. A 9.9 s reply seen once was Gemini latency variance (5.1 s and 2.6–3.0 s on reruns;
worker CPU stayed at 15–25 %).

## Files
- new: `src/trackb/avatar/{__init__,renderer,placeholder,output}.py`,
  `tests/avatar/test_placeholder.py` (4), `tests/avatar/test_output.py` (3)
- changed: `src/trackb/session/room_client.py`, `src/trackb/session/worker.py`,
  `src/trackb/session/entrypoint.py`, `src/trackb/session/conversation_entrypoint.py`,
  `src/trackb/config.py`, `dev/voice-test.html`, `kaggle/trackb_agent_worker.ipynb`,
  `tests/session/test_room_client.py` (+3, fake `publish_track` accepts options),
  `tests/session/test_prewarm.py` (+1)

## Verified
`pytest` → 260 passed; `ruff check` clean; live measurements above.
