"""The cross-track `run_conversation(agent_spec) -> LiveSession` entry point.

Mirrors how `POST /intake/start` (`api/routes.py`'s `start_intake`) wires a real LiveKit room +
join token via `LiveKitAdmin`: this brings a real `conversation-{agent_id}-{session_id}` room
into existence (dispatching `trackb.session.conversation_entrypoint`'s worker into it, via
`LiveKitAdmin.create_conversation_room`) instead of returning a stub session descriptor with no
LiveKit call behind it.
"""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel

from trackb.config import get_settings
from trackb.contracts.models import AgentSpec
from trackb.session.livekit_admin import LiveKitAdmin


class LiveSession(BaseModel):
    """The real cross-track `LiveSession` type: a live, joinable conversation room."""

    session_id: str
    agent_id: str
    room_name: str
    livekit_url: str
    token: str
    status: Literal["pending"] = "pending"


async def run_conversation(agent_spec: AgentSpec, livekit_admin: LiveKitAdmin) -> LiveSession:
    session_id = str(uuid.uuid4())

    room = await livekit_admin.create_conversation_room(agent_spec.agent_id, session_id)
    token = await livekit_admin.mint_join_token(room.name, identity=agent_spec.owner)

    return LiveSession(
        session_id=session_id,
        agent_id=agent_spec.agent_id,
        room_name=room.name,
        livekit_url=get_settings().livekit_url,
        token=token,
    )
