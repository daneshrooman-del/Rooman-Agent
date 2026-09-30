---
name: contract-check
description: Validate Track B's shared contract (the AgentSpec schema and the avatar-service client interface) plus lint/type-check/tests, before merging or handing off to Track A/C. Use before any PR that touches contracts/ or before declaring a feature done.
---

# Contract check

Load `track-b-conventions` first if it isn't already in context.

Run, in order, and report each result rather than stopping at the first failure:

1. `ruff check src tests` and `mypy src` — must be clean.
2. `pytest tests/contracts` — validates the `AgentSpec` schema (round-trips to/from JSON
   matching the shape in `track-b-conventions`) and the mocked avatar-service client (calls
   `create_avatar`/`generate` against the stub and checks the response shape, not real output).
3. `pytest` (full suite) — everything else.
4. Diff `src/trackb/contracts/` against the contract block in `.claude/skills/track-b-conventions/SKILL.md`
   — if they've drifted, that file is stale and must be updated in the same change, since it's
   the document Track A and Track C read to build against this service.

If any of 1–3 fail, fix them before considering the change done — a broken contract test means
Track A or Track C's stubbed integration will silently break when they point at the real
service later, which is much harder to debug than catching it here.
