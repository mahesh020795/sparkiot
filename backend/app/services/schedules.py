from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.domain import CommandLog, Device, Schedule
from app.services.mqtt import publish_command


DAY_CODES = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def unwrap_command_value(value: dict[str, Any]) -> Any:
    return value.get("raw", value)


def localize_schedule_time(schedule: Schedule, now: datetime) -> datetime:
    try:
        timezone = ZoneInfo(schedule.timezone)
    except ZoneInfoNotFoundError:
        timezone = UTC
    if now.tzinfo is None:
        now = now.replace(tzinfo=UTC)
    return now.astimezone(timezone)


def recurrence_matches(schedule: Schedule, local_now: datetime) -> bool:
    recurrence = (schedule.recurrence or "daily").lower()
    weekday = local_now.weekday()
    day_code = DAY_CODES[weekday]
    if recurrence == "daily":
        return True
    if recurrence == "weekdays":
        return weekday < 5
    if recurrence == "weekends":
        return weekday >= 5
    return day_code in {part.strip() for part in recurrence.split(",")}


def due_occurrence_key(schedule: Schedule, now: datetime | None = None) -> str | None:
    now = now or datetime.now(UTC)
    local_now = localize_schedule_time(schedule, now)
    if local_now.strftime("%H:%M") != schedule.time_of_day:
        return None
    if not recurrence_matches(schedule, local_now):
        return None
    occurrence = local_now.strftime("%Y%m%d%H%M")
    return f"sched:{schedule.id[:8]}:{occurrence}"


def run_due_schedules_once(db: Session, now: datetime | None = None) -> int:
    executed = 0
    schedules = db.scalars(select(Schedule).where(Schedule.is_active)).all()
    for schedule in schedules:
        key = due_occurrence_key(schedule, now)
        if not key:
            continue
        existing = db.scalar(select(CommandLog).where(CommandLog.tenant_id == schedule.tenant_id, CommandLog.status == key))
        if existing:
            continue
        device = db.get(Device, schedule.device_id)
        if not device or device.tenant_id != schedule.tenant_id or not device.is_active:
            continue
        command_value = unwrap_command_value(schedule.command_value)
        try:
            publish_command(schedule.tenant_id, schedule.device_id, schedule.channel, command_value)
            publish_status = key
        except Exception:
            publish_status = key
        db.add(CommandLog(tenant_id=schedule.tenant_id, device_id=schedule.device_id, channel=schedule.channel, value={"raw": command_value}, status=publish_status))
        executed += 1
    db.commit()
    return executed
