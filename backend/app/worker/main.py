import time
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete

from app.core.config import get_settings
from app.core.database import SessionLocal, init_db
from app.models.domain import Telemetry
from app.services.schedules import run_due_schedules_once


def retention_once() -> int:
    cutoff = datetime.now(UTC) - timedelta(days=get_settings().starter_retention_days)
    db = SessionLocal()
    try:
        result = db.execute(delete(Telemetry).where(Telemetry.observed_at < cutoff))
        db.commit()
        return result.rowcount or 0
    finally:
        db.close()


def run_forever() -> None:
    init_db()
    while True:
        retention_once()
        db = SessionLocal()
        try:
            run_due_schedules_once(db)
        finally:
            db.close()
        time.sleep(60)


if __name__ == "__main__":
    run_forever()
