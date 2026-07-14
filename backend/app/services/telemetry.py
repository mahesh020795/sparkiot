from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.security import verify_secret
from app.models.domain import AlertRule, Device, Notification, Telemetry, User
from app.schemas.api import TelemetryIngestRequest
from app.services.push import deliver_notification_pushes


def normalize_value(channel: str, value: Any) -> dict:
    looks_like_gps = isinstance(value, dict) and "lat" in value and "lng" in value
    looks_like_camera = isinstance(value, dict) and "url" in value
    if channel in {"gps", "location"} or looks_like_gps:
        if not isinstance(value, dict) or "lat" not in value or "lng" not in value:
            raise ValueError("GPS value requires lat and lng")
        lat = float(value["lat"])
        lng = float(value["lng"])
        if not -90 <= lat <= 90 or not -180 <= lng <= 180:
            raise ValueError("GPS coordinates out of range")
        return {"lat": lat, "lng": lng, **{k: v for k, v in value.items() if k not in {"lat", "lng"}}}
    if channel == "camera" or looks_like_camera:
        if not isinstance(value, dict) or "url" not in value:
            raise ValueError("Camera value requires url")
        return value
    return {"raw": value}


def ingest(db: Session, tenant_id: str, payload: TelemetryIngestRequest) -> Telemetry:
    device = db.get(Device, payload.device_id)
    if not device or device.tenant_id != tenant_id or not device.is_active:
        raise ValueError("Device not found")
    if not verify_secret(payload.token, device.secret_hash):
        raise ValueError("Invalid device token")
    record = Telemetry(tenant_id=tenant_id, project_id=device.project_id, device_id=device.id, channel=payload.channel, value=normalize_value(payload.channel, payload.value), unit=payload.unit, message_id=payload.message_id, observed_at=payload.ts or datetime.now(UTC))
    device.is_online = True
    device.last_seen_at = datetime.now(UTC)
    db.add(record)
    evaluate_alerts(db, tenant_id, device.id, payload.channel, payload.value)
    db.commit()
    db.refresh(record)
    return record


def latest_for_project(db: Session, tenant_id: str, project_id: str) -> list[Telemetry]:
    rows = db.scalars(select(Telemetry).where(Telemetry.tenant_id == tenant_id, Telemetry.project_id == project_id).order_by(desc(Telemetry.server_at)).limit(200)).all()
    latest: dict[tuple[str, str], Telemetry] = {}
    for row in rows:
        latest.setdefault((row.device_id, row.channel), row)
    return list(latest.values())


def evaluate_alerts(db: Session, tenant_id: str, device_id: str, channel: str, raw_value: Any) -> None:
    if not isinstance(raw_value, int | float):
        return
    user = db.scalar(select(User).where(User.tenant_id == tenant_id, User.is_active))
    if not user:
        return
    rules = db.scalars(select(AlertRule).where(AlertRule.tenant_id == tenant_id, AlertRule.device_id == device_id, AlertRule.channel == channel, AlertRule.is_active)).all()
    now = datetime.now(UTC)
    for rule in rules:
        hit = {">": raw_value > rule.threshold, ">=": raw_value >= rule.threshold, "<": raw_value < rule.threshold, "<=": raw_value <= rule.threshold, "==": raw_value == rule.threshold}[rule.operator]
        if not hit:
            continue
        if rule.last_triggered_at and rule.last_triggered_at.replace(tzinfo=UTC) + timedelta(seconds=rule.cooldown_seconds) > now:
            continue
        notification = Notification(tenant_id=tenant_id, user_id=user.id, title="Alert triggered", body=f"{channel} is {raw_value} {rule.operator} {rule.threshold}")
        db.add(notification)
        db.flush()
        deliver_notification_pushes(db, notification)
        rule.last_triggered_at = now
