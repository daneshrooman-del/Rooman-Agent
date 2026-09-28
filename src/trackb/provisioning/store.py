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


def list_agent_specs(*, engine: Engine | None = None) -> list[AgentSpec]:
    engine = engine or get_engine()
    with Session(engine) as session:
        records = session.exec(select(AgentSpecRecord)).all()
        # Sorted in Python rather than via `.order_by(AgentSpecRecord.created_at)` --
        # sqlmodel's Field-typed columns don't satisfy mypy's ColumnElement checks
        # for order_by without the (unconfigured) sqlmodel mypy plugin.
        ordered = sorted(records, key=lambda record: record.created_at)
        return [AgentSpec.model_validate_json(record.data) for record in ordered]
