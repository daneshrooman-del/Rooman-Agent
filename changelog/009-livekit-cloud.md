# 009 — Switched transport to LiveKit Cloud (free tier)

**Plan step:** Transport — prerequisite for the Kaggle GPU phase

## What we did
- Local `.env` now points `TRACKB_LIVEKIT_URL/API_KEY/API_SECRET` at a LiveKit Cloud project.
  The local-server values are kept as comments, so switching back is three lines. No code changes.
- Restarted the API and the agent worker against the cloud.

## Setup issues hit (worth knowing for the Kaggle Secrets step)
1. First secret pasted was a 345-char JWT (`eyJ…`) — an access token from the dashboard, not the
   API secret. LiveKit returned **401**. The real API secret is ~43 random chars, shown once at
   *Settings → API Keys → Create key*.
2. The dashboard copies variables as `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`;
   this backend reads only `TRACKB_`-prefixed names, so the values were silently ignored. Renamed.

## Verified
- Server API auth: `list_rooms` OK.
- Worker registered at `wss://project-…livekit.cloud`.
- Two headless-caller sessions through the cloud relay: agent audio **5.5 s / 4.9 s** after the
  caller stopped (local server: 5.7–6.0 s) — relay overhead is negligible; latency is still the
  CPU-bound STT/TTS on this machine.

## Why it matters
Kaggle notebooks can reach this URL (outbound `wss`), unlike the server on this PC. The local
Docker LiveKit server is still running and can be stopped with
`docker compose -f infra/livekit/docker-compose.yml down`.
