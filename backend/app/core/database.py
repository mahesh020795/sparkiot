from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def make_engine(url: str | None = None):
    database_url = url or get_settings().database_url
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(database_url, pool_pre_ping=True, connect_args=connect_args)


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_runtime_indexes(bind: Engine) -> None:
    """Apply idempotent lightweight indexes for existing starter deployments.

    The MVP currently uses SQLAlchemy metadata directly rather than Alembic.
    Fresh databases get indexes from model metadata; existing VPS databases need
    this small startup guard so production safety improvements are applied
    without dropping data.
    """

    dialect = bind.dialect.name
    if dialect == "postgresql":
        statement = """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_telemetry_message_retry
        ON telemetry (tenant_id, device_id, channel, message_id)
        WHERE message_id IS NOT NULL
        """
    elif dialect == "sqlite":
        statement = """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_telemetry_message_retry
        ON telemetry (tenant_id, device_id, channel, message_id)
        WHERE message_id IS NOT NULL
        """
    else:
        return

    with bind.begin() as connection:
        connection.execute(text(statement))


def init_db() -> None:
    from app.models import domain  # noqa: F401

    Base.metadata.create_all(bind=engine)
    ensure_runtime_indexes(engine)
