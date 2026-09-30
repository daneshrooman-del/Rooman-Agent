"""The interface this service calls into Track A's avatar engine.

Track A owns the real implementation. Until it's ready, build and test against
`StubAvatarServiceClient` below — never block on Track A's branch to make progress.
"""

from collections.abc import AsyncIterator
from typing import Protocol, runtime_checkable


@runtime_checkable
class AvatarServiceClient(Protocol):
    async def create_avatar(self, video_file: bytes) -> str:
        """Train a digital twin from a reference video. Returns an avatar_id."""
        ...

    async def generate(
        self, avatar_id: str, script_or_audio: str | bytes, action_type: str
    ) -> bytes | AsyncIterator[bytes]:
        """Generate a video (or stream) of the given avatar performing action_type."""
        ...


class StubAvatarServiceClient:
    """In-memory stand-in for Track A's service, used in tests and local dev."""

    def __init__(self) -> None:
        self._avatars: dict[str, bytes] = {}
        self._next_id = 0

    async def create_avatar(self, video_file: bytes) -> str:
        self._next_id += 1
        avatar_id = f"stub-avatar-{self._next_id}"
        self._avatars[avatar_id] = video_file
        return avatar_id

    async def generate(
        self, avatar_id: str, script_or_audio: str | bytes, action_type: str
    ) -> bytes:
        if avatar_id not in self._avatars:
            raise KeyError(f"unknown avatar_id: {avatar_id}")
        payload = (
            script_or_audio if isinstance(script_or_audio, bytes) else script_or_audio.encode()
        )
        return b"STUB_VIDEO:" + action_type.encode() + b":" + payload
