from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.database import get_db
from app.core.security import hash_secret, issue_device_secret
from app.models.domain import CommandLog, Device, Project, User
from app.schemas.api import CommandRequest, DeviceCreate, DeviceResponse, DeviceUpdate, StatusResponse
from app.services.mqtt import command_topic, publish_command, telemetry_topic
from app.services.plans import PlanLimitError, assert_can_create_device

router = APIRouter(prefix="/devices", tags=["devices"])


def _device_response(device: Device, token: str | None = None) -> DeviceResponse:
    return DeviceResponse(id=device.id, project_id=device.project_id, name=device.name, board=device.board, is_online=device.is_online, last_seen_at=device.last_seen_at, token=token, telemetry_topic=telemetry_topic(device.tenant_id, device.id, "{channel}"), command_topic=command_topic(device.tenant_id, device.id, "{channel}"))


@router.get("", response_model=list[DeviceResponse])
def list_devices(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [_device_response(device) for device in db.scalars(select(Device).where(Device.tenant_id == user.tenant_id, Device.is_active)).all()]


@router.post("", response_model=DeviceResponse, status_code=201)
def create_device(payload: DeviceCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    project = db.get(Project, payload.project_id)
    if not project or project.tenant_id != user.tenant_id or not project.is_active:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        assert_can_create_device(db, user.tenant_id)
    except PlanLimitError as exc:
        raise HTTPException(status_code=409, detail={"code": exc.code, "message": str(exc)}) from exc
    token = issue_device_secret()
    device = Device(tenant_id=user.tenant_id, project_id=payload.project_id, name=payload.name, board=payload.board, secret_hash=hash_secret(token))
    db.add(device)
    db.commit()
    db.refresh(device)
    return _device_response(device, token)


def _tenant_device(device_id: str, user: User, db: Session) -> Device:
    device = db.get(Device, device_id)
    if not device or device.tenant_id != user.tenant_id or not device.is_active:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@router.put("/{device_id}", response_model=DeviceResponse)
def update_device(device_id: str, payload: DeviceUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    device = _tenant_device(device_id, user, db)
    project = db.get(Project, payload.project_id)
    if not project or project.tenant_id != user.tenant_id or not project.is_active:
        raise HTTPException(status_code=404, detail="Project not found")
    device.project_id = payload.project_id
    device.name = payload.name
    device.board = payload.board
    db.commit()
    db.refresh(device)
    return _device_response(device)


@router.delete("/{device_id}", response_model=StatusResponse)
def delete_device(device_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    device = _tenant_device(device_id, user, db)
    device.is_active = False
    device.is_online = False
    db.commit()
    return StatusResponse(message="Device archived")


@router.post("/{device_id}/regenerate-token", response_model=DeviceResponse)
def regenerate_token(device_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    device = _tenant_device(device_id, user, db)
    token = issue_device_secret()
    device.secret_hash = hash_secret(token)
    db.commit()
    return _device_response(device, token)


@router.post("/{device_id}/commands", status_code=202)
def send_command(device_id: str, payload: CommandRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    device = db.get(Device, device_id)
    if not device or device.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Device not found")
    try:
        publish_command(user.tenant_id, device_id, payload.channel, payload.value)
        status = "published"
    except Exception:
        status = "queued"
    db.add(CommandLog(tenant_id=user.tenant_id, device_id=device_id, channel=payload.channel, value={"raw": payload.value}, status=status))
    db.commit()
    return {"status": status, "topic": command_topic(user.tenant_id, device_id, payload.channel)}


@router.get("/{device_id}/command-logs")
def command_logs(device_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    device = db.get(Device, device_id)
    if not device or device.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Device not found")
    logs = db.scalars(
        select(CommandLog)
        .where(CommandLog.tenant_id == user.tenant_id, CommandLog.device_id == device_id)
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
