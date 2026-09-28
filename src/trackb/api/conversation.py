"""Placeholder for the cross-track `run_conversation(agent_spec) -> LiveSession` entry point.

The real implementation joins the LiveKit room set up by `trackb.session` /
`trackb.stt`, which another agent is building concurrently and doesn't exist
yet. Until then this just validates its input and returns a stub session
descriptor, so `POST /agents/{agent_id}/conversation/start` has something
concrete to call. Swap the import in `api/routes.py` for the real
`run_conversation` (and drop `LiveSessionStub` for the real `LiveSession`)
once `trackb.session` lands.
"""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel

from trackb.contracts.models import AgentSpec


class LiveSessionStub(BaseModel):
    """Placeholder standing in for the real `LiveSession` type from `trackb.session`."""

    session_id: str
    agent_id: str
    room_name: str
    status: Literal["pending"] = "pending"


def run_conversation(agent_spec: AgentSpec) -> LiveSessionStub:
    session_id = str(uuid.uuid4())
    room_name = f"agent-{agent_spec.agent_id}-{session_id[:8]}"
    return LiveSessionStub(session_id=session_id, agent_id=agent_spec.agent_id, room_name=room_name)
