# 005 — Self-hosted local LiveKit server

**Plan step:** Transport (step 1 prerequisite)

## What we did
- Added `infra/livekit/livekit.yaml` and `docker-compose.yml` to run `livekit-server` locally
  (host networking; signaling on 7880, TCP media 7881, UDP media 7882) with a dev-only API key.
- Documented the matching `TRACKB_LIVEKIT_*` values in `.env.example`.
- Pulled `livekit/livekit-server:latest` (v1.13.7) and started it: container `livekit-livekit-1`.

## Why
Free, no account, no vendor limits, and the backend already reads `TRACKB_LIVEKIT_URL/KEY/SECRET`
so no code changes are needed.

## Important constraint (Kaggle)
Kaggle notebooks have **no inbound ports** and live on the public internet. A LiveKit server
running on this PC is not reachable from them, and WebRTC media can't ride a normal HTTP tunnel.
So:
- **Voice-only dev loop** (agent worker + browser + LiveKit all on this machine): works fine.
- **Kaggle GPU phase**: the server must be publicly reachable (VPS with open 7880/7881/7882 +
  TURN, or LiveKit Cloud free tier). Same config/code, only the three env vars change.

## To run
```bash
docker compose -f infra/livekit/docker-compose.yml up -d
TRACKB_LIVEKIT_URL=ws://localhost:7880 TRACKB_LIVEKIT_API_KEY=devkey \
TRACKB_LIVEKIT_API_SECRET=dev-secret-change-me-0123456789abcdef \
python -m trackb.session.conversation_entrypoint dev
```

## Files
- new: `infra/livekit/livekit.yaml`, `infra/livekit/docker-compose.yml`
- changed: `.env.example`

## Verified
Server is up (`curl localhost:7880` → `OK`). Authenticated with the dev key via `livekit-api`:
created a room, listed it, deleted it. No agent worker or browser has joined yet.

## Tunnelling (ngrok) — decision
ngrok gives an https/wss URL, which is useful for *signaling* only. It does not carry WebRTC media
(no UDP; free TCP tunnels need a verified account, and LiveKit can't advertise a remapped port),
so calls would connect but have no audio/video. Not used. Browsers allow mic/camera on
`http://localhost`, so local dev needs no https. For Kaggle/remote use a VPS or LiveKit Cloud.
