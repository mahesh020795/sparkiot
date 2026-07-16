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
    """Apply idempotent lightweight upgrades for existing starter deployments.

    The MVP currently uses SQLAlchemy metadata directly rather than Alembic.
    Fresh databases get columns and indexes from model metadata; existing VPS
    databases need this small startup guard so production safety improvements
    are applied without dropping data.
    """

    dialect = bind.dialect.name
    if dialect not in {"postgresql", "sqlite"}:
        return

    with bind.begin() as connection:
        if dialect == "postgresql":
            has_users = connection.execute(text("SELECT to_regclass('public.users') IS NOT NULL")).scalar()
            if has_users:
                column_exists = connection.execute(
                    text(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM information_schema.columns
                            WHERE table_schema = 'public'
                              AND table_name = 'users'
                              AND column_name = 'email_verified_at'
                        )
                        """
                    )
                ).scalar()
                if not column_exists:
                    connection.execute(text("ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP WITH TIME ZONE"))

            has_telemetry = connection.execute(text("SELECT to_regclass('public.telemetry') IS NOT NULL")).scalar()
            if has_telemetry:
                connection.execute(
                    text(
                        """
                        CREATE UNIQUE INDEX IF NOT EXISTS uq_telemetry_message_retry
                        ON telemetry (tenant_id, device_id, channel, message_id)
                        WHERE message_id IS NOT NULL
                        """
                    )
                )

        if dialect == "sqlite":
            tables = {row[0] for row in connection.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}
            if "users" in tables:
                columns = {row[1] for row in connection.execute(text("PRAGMA table_info(users)")).fetchall()}
                if "email_verified_at" not in columns:
                    connection.execute(text("ALTER TABLE users ADD COLUMN email_verified_at DATETIME"))

            if "telemetry" in tables:
                connection.execute(
                    text(
                        """
                        CREATE UNIQUE INDEX IF NOT EXISTS uq_telemetry_message_retry
                        ON telemetry (tenant_id, device_id, channel, message_id)
                        WHERE message_id IS NOT NULL
                        """
                    )
                )


def init_db() -> None:
    from app.models import domain  # noqa: F401

    Base.metadata.create_all(bind=engine)
    ensure_runtime_indexes(engine)
