"""Redis-backed, resumable session-state store.

Replaces two things that used to live only in process memory:

- `api/sessions.py`'s placeholder in-memory dict, which held session metadata
  (session_id/owner/avatar_id/voice_id) for `POST /intake/start`.
- `IntakeGraph`'s accumulated conversation state (`IntakeSlots` + utterance history), which
  used to live purely on the LiveKit worker process's stack -- if the job crashed or the
  WebRTC connection dropped mid-conversation, everything was lost.

Both are now JSON-serialized under TTL'd Redis keys, keyed by `session_id`. TTL is a
`Settings` value (`session_state_ttl_seconds`) so an abandoned session doesn't live forever.

This is the resume mechanism: LiveKit's own job-dispatch protocol has a `resuming` field on
job requests, set when a worker reconnects after a drop rather than starting a brand new job.
`session/entrypoint.py`'s `intake_entrypoint` looks up `load_intake_progress(session_id)` at
startup -- if prior progress exists (whether this is a LiveKit-level resume or simply a worker
restart against the same `session_id`), it rehydrates `IntakeGraph` from it instead of
starting blank. See `intake_entrypoint`'s own module docstring for the wiring.

Every Redis call goes through an explicit timeout and a bounded retry, matching the pattern
used for every other external call in this codebase (`session/livekit_admin.py`, `kb/store.py`).
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import structlog
from pydantic import BaseModel, Field
from redis.asyncio import Redis
from tenacity import retry, stop_after_attempt, wait_exponential

from trackb.config import Settings, get_settings
from trackb.intake.schema import IntakeSlots

logger = structlog.get_logger(__name__)

REDIS_TIMEOUT_SECONDS = 5.0

_RETRY = retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=4),
    reraise=True,
)

_SESSION_KEY_PREFIX = "trackb:session:"
_INTAKE_PROGRESS_KEY_PREFIX = "trackb:intake-progress:"
_REFERENCE_DOCUMENTS_KEY_PREFIX = "trackb:reference-docs:"


class SessionStoreError(Exception):
    """Raised when a Redis-backed session-store operation fails (connection failure, timeout,
    or any other error talking to Redis). Callers never see a bare redis exception or a hang."""


class SessionRecord(BaseModel):
    """Session metadata -- what `api/sessions.py`'s in-memory `IntakeSessionRecord` used to
    hold, now persisted in Redis instead of a process-local dict."""

    session_id: str
    owner: str
    avatar_id: str | None = None
    voice_id: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class IntakeProgress(BaseModel):
    """Accumulated `IntakeGraph` conversation state for one session: filled `IntakeSlots` plus
    the utterance history used to build extraction prompts (see `intake/graph.py`'s
    `_build_extraction_prompt`) -- both are needed to rehydrate `IntakeGraph` faithfully."""

    slots: IntakeSlots
    history: list[str] = Field(default_factory=list)


class ReferenceDocuments(BaseModel):
    """Raw text of reference documents (e.g. a job description PDF) uploaded alongside an
    intake session -- see `api/routes.py`'s `POST /intake/{session_id}/documents` and
    `IntakeSessionResult.reference_documents`."""

    documents: list[str] = Field(default_factory=list)


def _session_key(session_id: str) -> str:
    return f"{_SESSION_KEY_PREFIX}{session_id}"


def _intake_progress_key(session_id: str) -> str:
    return f"{_INTAKE_PROGRESS_KEY_PREFIX}{session_id}"


def _reference_documents_key(session_id: str) -> str:
    return f"{_REFERENCE_DOCUMENTS_KEY_PREFIX}{session_id}"


class RedisSessionStore:
    """Session metadata + intake-progress persistence, backed by `redis.asyncio.Redis`.

    Accepts an optional `redis_client=` (mirroring `KnowledgeBaseStore`'s optional
    `qdrant_client=`) so tests can inject a fake in-memory client instead of talking to a real
    Redis server.
    """

    def __init__(
        self,
        settings: Settings | None = None,
        redis_client: Redis | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._client = redis_client or Redis.from_url(self._settings.redis_url)
        self._ttl_seconds = self._settings.session_state_ttl_seconds

    async def aclose(self) -> None:
        await self._client.aclose()

    # -- session metadata -------------------------------------------------------------

    async def save_session(
        self,
        session_id: str,
        *,
        owner: str,
        avatar_id: str | None = None,
        voice_id: str | None = None,
    ) -> SessionRecord:
        record = SessionRecord(
            session_id=session_id, owner=owner, avatar_id=avatar_id, voice_id=voice_id
        )
        await self._set(_session_key(session_id), record.model_dump_json())
        logger.info("session_state_saved", session_id=session_id, owner=owner)
        return record

    async def get_session(self, session_id: str) -> SessionRecord | None:
        raw = await self._get(_session_key(session_id))
        if raw is None:
            return None
        return SessionRecord.model_validate_json(raw)

    async def clear_session(self, session_id: str) -> None:
        await self._delete(_session_key(session_id))
        logger.info("session_state_cleared", session_id=session_id)

    # -- intake progress ---------------------------------------------------------------

    async def save_intake_progress(
        self, session_id: str, slots: IntakeSlots, history: list[str]
    ) -> None:
        progress = IntakeProgress(slots=slots, history=list(history))
        await self._set(_intake_progress_key(session_id), progress.model_dump_json())
        logger.info(
            "intake_progress_saved", session_id=session_id, history_length=len(history)
        )

    async def load_intake_progress(self, session_id: str) -> tuple[IntakeSlots, list[str]] | None:
        raw = await self._get(_intake_progress_key(session_id))
        if raw is None:
            return None
        progress = IntakeProgress.model_validate_json(raw)
        return progress.slots, progress.history

    async def clear_intake_progress(self, session_id: str) -> None:
        await self._delete(_intake_progress_key(session_id))
        logger.info("intake_progress_cleared", session_id=session_id)

    # -- reference documents -------------------------------------------------------------

    async def add_reference_document(self, session_id: str, text: str) -> None:
        """Append `text` (the plain-text extraction of one uploaded document) to the list of
        reference documents accumulated for `session_id` so far."""
        documents = await self.get_reference_documents(session_id)
        documents.append(text)
        docs = ReferenceDocuments(documents=documents)
        await self._set(_reference_documents_key(session_id), docs.model_dump_json())
        logger.info(
            "reference_document_added",
            session_id=session_id,
            documents_count=len(documents),
            characters=len(text),
        )

    async def get_reference_documents(self, session_id: str) -> list[str]:
        raw = await self._get(_reference_documents_key(session_id))
        if raw is None:
            return []
        return ReferenceDocuments.model_validate_json(raw).documents

    async def clear_reference_documents(self, session_id: str) -> None:
        await self._delete(_reference_documents_key(session_id))
        logger.info("reference_documents_cleared", session_id=session_id)

    # -- Redis boundary: every call gets a timeout + bounded retry, wrapped into
    #    SessionStoreError so a connection failure never hangs or crashes raw ------------

    @_RETRY
    async def _set(self, key: str, value: str) -> None:
        try:
            await asyncio.wait_for(
                self._client.set(key, value, ex=self._ttl_seconds),
                timeout=REDIS_TIMEOUT_SECONDS,
            )
        except Exception as exc:
            logger.warning("redis_set_failed", key=key, error=str(exc))
            raise SessionStoreError(f"failed to write key {key!r}: {exc}") from exc

    @_RETRY
    async def _get(self, key: str) -> str | None:
        try:
            value = await asyncio.wait_for(self._client.get(key), timeout=REDIS_TIMEOUT_SECONDS)
        except Exception as exc:
            logger.warning("redis_get_failed", key=key, error=str(exc))
            raise SessionStoreError(f"failed to read key {key!r}: {exc}") from exc

        if value is None:
            return None
        return value.decode("utf-8") if isinstance(value, bytes) else value

    @_RETRY
    async def _delete(self, key: str) -> None:
        try:
            await asyncio.wait_for(self._client.delete(key), timeout=REDIS_TIMEOUT_SECONDS)
        except Exception as exc:
            logger.warning("redis_delete_failed", key=key, error=str(exc))
            raise SessionStoreError(f"failed to delete key {key!r}: {exc}") from exc
