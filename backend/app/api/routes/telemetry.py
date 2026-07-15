from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.database import get_db
from app.models.domain import Device, Telemetry, User
from app.schemas.api import TelemetryIngestRequest, TelemetryResponse
from app.services.demo_live import build_history_csv
from app.services.realtime import hub
from app.services.telemetry import ingest, latest_for_project

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


def _response(record: Telemetry) -> TelemetryResponse:
    return TelemetryResponse(id=record.id, project_id=record.project_id, device_id=record.device_id, channel=record.channel, value=record.value.get("raw", record.value), unit=record.unit, observed_at=record.observed_at, server_at=record.server_at)


def _tenant_device_or_404(db: Session, tenant_id: str, device_id: str) -> Device:
    device = db.get(Device, device_id)
    if not device or device.tenant_id != tenant_id or not device.is_active:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


def _history_query(tenant_id: str, device_id: str, channel: str | None = None):
    stmt = select(Telemetry).where(Telemetry.tenant_id == tenant_id, Telemetry.device_id == device_id)
    if channel:
        stmt = stmt.where(Telemetry.channel == channel)
    return stmt.order_by(desc(Telemetry.observed_at)).limit(1000)


@router.post("/ingest", response_model=TelemetryResponse, status_code=201)
async def ingest_telemetry(payload: TelemetryIngestRequest, db: Session = Depends(get_db)):
    device = db.get(Device, payload.device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    try:
        record = ingest(db, device.tenant_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await hub.publish(record.tenant_id, {"type": "telemetry", "payload": _response(record).model_dump(mode="json")}, record.project_id)
    return _response(record)


@router.get("/projects/{project_id}/latest", response_model=list[TelemetryResponse])
def latest(project_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [_response(record) for record in latest_for_project(db, user.tenant_id, project_id)]


@router.get("/devices/{device_id}/history", response_model=list[TelemetryResponse])
def history(device_id: str, channel: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _tenant_device_or_404(db, user.tenant_id, device_id)
    return [_response(row) for row in db.scalars(_history_query(user.tenant_id, device_id, channel)).all()]


@router.get("/devices/{device_id}/history.csv")
def history_csv(device_id: str, channel: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    device = _tenant_device_or_404(db, user.tenant_id, device_id)
    records = db.scalars(_history_query(user.tenant_id, device.id, channel)).all()
    csv_body = build_history_csv(records)
    filename = f"spark-iot-{device.id}-{channel or 'all'}-history.csv"
    return Response(
        content=csv_body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
