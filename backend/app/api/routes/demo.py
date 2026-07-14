from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models.domain import CommandLog, Device
from app.schemas.api import CommandRequest
from app.services.demo_live import DEMO_TENANT_ID, build_board_test_payload, build_demo_command_response, build_latest_map
from app.services.mqtt import publish_command
from app.services.telemetry import latest_for_project

router = APIRouter(prefix="/demo", tags=["demo"])


def _public_host(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-host")
    host = forwarded or request.headers.get("host", "localhost")
    return host.split(":")[0]


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
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Demo device not found")
    try:
        publish_command(DEMO_TENANT_ID, device_id, payload.channel, payload.value)
        status = "published"
    except Exception:
        status = "queued"
    db.add(CommandLog(tenant_id=DEMO_TENANT_ID, device_id=device_id, channel=payload.channel, value={"raw": payload.value}, status=status))
    db.commit()
    return build_demo_command_response(tenant_id=DEMO_TENANT_ID, device_id=device_id, channel=payload.channel, value=payload.value, status=status)
