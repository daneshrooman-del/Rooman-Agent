"""Persistence for provisioned AgentSpecs.

Uses `sqlmodel` against `Settings.database_url` (sqlite by default for local
dev; swap the URL for a Postgres DSN in production per `track-b-conventions`).
Rows store the serialized `AgentSpec` JSON rather than a fully normalized
schema -- `AgentSpec` is the cross-track contract and is expected to evolve,
so re-validating it out of JSON on read keeps this table from needing a
migration every time a field is added.
"""

from __future__ import annotations

from datetime import datetime, timezone
from functools import cache

from sqlalchemy.engine import Engine
from sqlmodel import Field, Session, SQLModel, create_engine, select

from trackb.config import get_settings
from trackb.contracts.models import AgentSpec


class AgentSpecRecord(SQLModel, table=True):
    """One row per provisioned agent, keyed by agent_id."""

    agent_id: str = Field(primary_key=True)
    owner: str = Field(index=True)
    status: str = Field(index=True)
    data: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


@cache
def get_engine(database_url: str | None = None) -> Engine:
    """Return a process-wide engine for `database_url` (or the configured default).

    Cached per URL so repeated calls (e.g. one per FastAPI request via `Depends`)
    reuse the same connection pool instead of reopening the sqlite file each time.
    """
    url = database_url or get_settings().database_url
    connect_args: dict[str, bool] = {"check_same_thread": False} if url.startswith("sqlite") else {}
    engine = create_engine(url, connect_args=connect_args)
    SQLModel.metadata.create_all(engine)
    return engine


def save_agent_spec(spec: AgentSpec, *, engine: Engine | None = None) -> None:
    engine = engine or get_engine()
    record = AgentSpecRecord(
        agent_id=spec.agent_id,
        owner=spec.owner,
        status=spec.status,
        data=spec.model_dump_json(),
    )
    with Session(engine) as session:
        session.merge(record)
        session.commit()


def get_agent_spec(agent_id: str, *, engine: Engine | None = None) -> AgentSpec | None:
    engine = engine or get_engine()
    with Session(engine) as session:
        record = session.get(AgentSpecRecord, agent_id)
        if record is None:
            return None
        return AgentSpec.model_validate_json(record.data)


def get_agent_spec_with_created_at(
    agent_id: str, *, engine: Engine | None = None
) -> tuple[AgentSpec, datetime] | None:
    """Like `get_agent_spec`, but also returns the row's `created_at` -- needed by the
    `GET /frontend/agents*` routes (`api/routes.py`), whose wire format has a `createdAt` field
    `AgentSpec` itself doesn't carry. Added rather than changing `get_agent_spec`'s return type,
    since other code (Track A/C's contract, `conversation_entrypoint._resolve_agent_spec`, etc.)
    depends on `get_agent_spec`/`list_agent_specs` returning `AgentSpec` only.
    """
    engine = engine or get_engine()
    with Session(engine) as session:
        record = session.get(AgentSpecRecord, agent_id)
        if record is None:
            return None
        return AgentSpec.model_validate_json(record.data), record.created_at


def list_agent_specs(*, engine: Engine | None = None) -> list[AgentSpec]:
    engine = engine or get_engine()
    with Session(engine) as session:
        records = session.exec(select(AgentSpecRecord)).all()
        # Sorted in Python rather than via `.order_by(AgentSpecRecord.created_at)` --
        # sqlmodel's Field-typed columns don't satisfy mypy's ColumnElement checks
        # for order_by without the (unconfigured) sqlmodel mypy plugin.
        ordered = sorted(records, key=lambda record: record.created_at)
        return [AgentSpec.model_validate_json(record.data) for record in ordered]


def list_agent_specs_with_created_at(
    *, engine: Engine | None = None
) -> list[tuple[AgentSpec, datetime]]:
    """Like `list_agent_specs`, but also returns each row's `created_at` -- see
    `get_agent_spec_with_created_at`'s docstring for why this exists as a separate function
    rather than changing `list_agent_specs` itself. A separate query rather than looping
    `get_agent_spec_with_created_at` per id, to avoid an N+1 query for `GET /frontend/agents`.
    """
    engine = engine or get_engine()
    with Session(engine) as session:
        records = session.exec(select(AgentSpecRecord)).all()
        ordered = sorted(records, key=lambda record: record.created_at)
        return [
            (AgentSpec.model_validate_json(record.data), record.created_at) for record in ordered
        ]
