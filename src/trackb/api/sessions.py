"""In-memory registry of started intake sessions.

This is a placeholder for the Redis-backed, resumable session-state store
that the `session/` track is building (so a dropped WebRTC connection can
resume mid-intake instead of restarting). It exists only so `POST
/intake/start` has somewhere to record the session_id/avatar assignment it
hands back. Swap this module out once `trackb.session` provides the real
store -- do not build further functionality on top of this dict.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class IntakeSessionRecord:
    session_id: str
    owner: str
    avatar_id: str | None = None
    voice_id: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


_SESSIONS: dict[str, IntakeSessionRecord] = {}


def create_session(
    session_id: str,
    *,
    owner: str,
    avatar_id: str | None = None,
    voice_id: str | None = None,
) -> IntakeSessionRecord:
    record = IntakeSessionRecord(
        session_id=session_id, owner=owner, avatar_id=avatar_id, voice_id=voice_id
    )
    _SESSIONS[session_id] = record
    return record


def get_session(session_id: str) -> IntakeSessionRecord | None:
    return _SESSIONS.get(session_id)
