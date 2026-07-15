from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models.domain import CommandLog, Dashboard, Device, DeviceTemplateRecord, Telemetry
from app.schemas.api import CommandRequest, TemplateStudioUpdate
from app.services.demo_live import DEMO_TENANT_ID, build_board_test_payload, build_demo_command_response, build_history_csv, build_latest_map, history_row_payload
from app.services.mqtt import publish_command
from app.services.telemetry import latest_for_project

router = APIRouter(prefix="/demo", tags=["demo"])

def _demo_device_or_404(db: Session, device_id: str) -> Device:
    device = db.get(Device, device_id)
    if not device or device.tenant_id != DEMO_TENANT_ID or not device.is_active:
        raise HTTPException(status_code=404, detail="Demo device not found")
    return device


def _demo_history_query(device_id: str, channel: str | None = None):
    stmt = select(Telemetry).where(Telemetry.tenant_id == DEMO_TENANT_ID, Telemetry.device_id == device_id)
    if channel:
        stmt = stmt.where(Telemetry.channel == channel)
    return stmt.order_by(desc(Telemetry.observed_at)).limit(1000)


def _public_host(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-host")
    host = forwarded or request.headers.get("host", "localhost")
    return host.split(":")[0]


def _template_payload(template: DeviceTemplateRecord, dashboard: Dashboard) -> dict:
    return {
        "id": template.id,
        "name": template.name,
        "board": template.board,
        "description": template.description,
        "revision": template.revision,
        "datastreams": template.datastreams,
        "notifications": template.notifications,
        "dashboard": {
            "id": dashboard.id,
            "project_id": dashboard.project_id,
            "name": dashboard.name,
            "revision": dashboard.revision,
            "widgets": dashboard.widgets,
        },
    }


def _get_demo_template(db: Session, template_id: str) -> tuple[DeviceTemplateRecord, Dashboard]:
    template = db.get(DeviceTemplateRecord, template_id)
    if not template or template.tenant_id != DEMO_TENANT_ID:
        raise HTTPException(status_code=404, detail="Demo template not found")
    dashboard = db.get(Dashboard, template.dashboard_id)
    if not dashboard or dashboard.tenant_id != DEMO_TENANT_ID:
        raise HTTPException(status_code=404, detail="Demo dashboard not found")
    return template, dashboard


@router.get("/templates")
def demo_templates(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(DeviceTemplateRecord)
        .where(DeviceTemplateRecord.tenant_id == DEMO_TENANT_ID)
        .order_by(DeviceTemplateRecord.created_at.asc())
    ).all()
    dashboards = {
        dashboard.id: dashboard
        for dashboard in db.scalars(select(Dashboard).where(Dashboard.tenant_id == DEMO_TENANT_ID)).all()
    }
    return [_template_payload(template, dashboards[template.dashboard_id]) for template in rows if template.dashboard_id in dashboards]


@router.get("/templates/{template_id}")
def demo_template(template_id: str, db: Session = Depends(get_db)):
    template, dashboard = _get_demo_template(db, template_id)
    return _template_payload(template, dashboard)


@router.put("/templates/{template_id}")
def demo_update_template(template_id: str, payload: TemplateStudioUpdate, db: Session = Depends(get_db)):
    template, dashboard = _get_demo_template(db, template_id)
    if payload.revision != template.revision:
        raise HTTPException(
            status_code=409,
            detail={"code": "stale_template_revision", "message": "Template was updated elsewhere. Refresh before saving again."},
        )
    if payload.dashboard.id != dashboard.id or payload.dashboard.project_id != template.project_id:
        raise HTTPException(status_code=400, detail="Dashboard does not belong to this template")

    template.name = payload.name
    template.board = payload.board
    template.description = payload.description
    template.datastreams = [stream.model_dump(exclude_none=True) for stream in payload.datastreams]
    template.notifications = [rule.model_dump(exclude_none=True) for rule in payload.notifications]
    template.revision += 1
    template.updated_at = datetime.now(UTC)

    dashboard.name = payload.dashboard.name
    dashboard.widgets = payload.dashboard.widgets
    dashboard.revision += 1
    dashboard.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(template)
    db.refresh(dashboard)
    return _template_payload(template, dashboard)


@router.get("/projects/{project_id}/latest")
def demo_project_latest(project_id: str, db: Session = Depends(get_db)):
    return build_latest_map(latest_for_project(db, DEMO_TENANT_ID, project_id))


@router.get("/projects/{project_id}/board-test")
def demo_board_test(project_id: str, request: Request, db: Session = Depends(get_db)):
    settings = get_settings()
    devices = db.scalars(
        select(Device).where(
            Device.tenant_id == DEMO_TENANT_ID,
            Device.project_id == project_id,
            Device.is_active.is_(True),
        )
    ).all()
    return build_board_test_payload(
        tenant_id=DEMO_TENANT_ID,
        project_id=project_id,
        public_host=_public_host(request),
        mqtt_port=settings.mqtt_port,
        devices=devices,
        latest=latest_for_project(db, DEMO_TENANT_ID, project_id),
    )


@router.post("/devices/{device_id}/commands", status_code=202)
def demo_send_command(device_id: str, payload: CommandRequest, db: Session = Depends(get_db)):
    device = db.get(Device, device_id)
    if not device or device.tenant_id != DEMO_TENANT_ID or not device.is_active:
        raise HTTPException(status_code=404, detail="Demo device not found")
    try:
        publish_command(DEMO_TENANT_ID, device_id, payload.channel, payload.value)
        status = "published"
    except Exception:
        status = "queued"
    db.add(CommandLog(tenant_id=DEMO_TENANT_ID, device_id=device_id, channel=payload.channel, value={"raw": payload.value}, status=status))
    db.commit()
    return build_demo_command_response(tenant_id=DEMO_TENANT_ID, device_id=device_id, channel=payload.channel, value=payload.value, status=status)


@router.get("/devices/{device_id}/command-logs")
def demo_command_logs(device_id: str, db: Session = Depends(get_db)):
    device = db.get(Device, device_id)
    if not device or device.tenant_id != DEMO_TENANT_ID or not device.is_active:
        raise HTTPException(status_code=404, detail="Demo device not found")
    logs = db.scalars(
        select(CommandLog)
        .where(CommandLog.tenant_id == DEMO_TENANT_ID, CommandLog.device_id == device_id)
        .order_by(CommandLog.created_at.desc())
        .limit(40)
    ).all()
    return [
        {
            "id": item.id,
            "device_id": item.device_id,
            "channel": item.channel,
            "value": item.value.get("raw", item.value) if isinstance(item.value, dict) else item.value,
            "status": item.status,
            "created_at": item.created_at,
        }
        for item in logs
    ]

@router.get("/devices/{device_id}/history")
def demo_device_history(device_id: str, channel: str | None = None, db: Session = Depends(get_db)):
    _demo_device_or_404(db, device_id)
    records = db.scalars(_demo_history_query(device_id, channel)).all()
    return [history_row_payload(record) for record in records]


@router.get("/devices/{device_id}/history.csv")
def demo_device_history_csv(device_id: str, channel: str | None = None, db: Session = Depends(get_db)):
    device = _demo_device_or_404(db, device_id)
    records = db.scalars(_demo_history_query(device_id, channel)).all()
    csv_body = build_history_csv(records)
    filename = f"spark-iot-{device.id}-{channel or 'all'}-history.csv"
    return Response(
        content=csv_body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
