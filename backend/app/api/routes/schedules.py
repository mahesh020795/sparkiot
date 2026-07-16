from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.database import get_db
from app.models.domain import Device, Project, Schedule, User
from app.schemas.api import ScheduleCreate, ScheduleResponse, StatusResponse
from app.services.schedules import unwrap_command_value

router = APIRouter(prefix="/schedules", tags=["schedules"])


def _schedule_response(schedule: Schedule) -> ScheduleResponse:
    return ScheduleResponse(
        id=schedule.id,
        project_id=schedule.project_id,
        device_id=schedule.device_id,
        channel=schedule.channel,
        value=unwrap_command_value(schedule.command_value),
        time_of_day=schedule.time_of_day,
        recurrence=schedule.recurrence,
        timezone=schedule.timezone,
        is_active=schedule.is_active,
    )


@router.get("", response_model=list[ScheduleResponse])
def list_schedules(user: User = Depends(current_user), db: Session = Depends(get_db)):
    schedules = db.scalars(select(Schedule).where(Schedule.tenant_id == user.tenant_id).order_by(Schedule.time_of_day)).all()
    return [_schedule_response(schedule) for schedule in schedules]


@router.post("", response_model=ScheduleResponse, status_code=201)
def create_schedule(payload: ScheduleCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    project = db.get(Project, payload.project_id)
    if not project or project.tenant_id != user.tenant_id or not project.is_active:
        raise HTTPException(status_code=404, detail="Project not found")
    device = db.get(Device, payload.device_id)
    if not device or device.tenant_id != user.tenant_id or device.project_id != project.id or not device.is_active:
        raise HTTPException(status_code=404, detail="Device not found")
    schedule = Schedule(
        tenant_id=user.tenant_id,
        project_id=project.id,
        device_id=device.id,
        channel=payload.channel,
        command_value={"raw": payload.value},
        timezone=payload.timezone,
        time_of_day=payload.time_of_day,
        recurrence=payload.recurrence,
        is_active=payload.is_active,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return _schedule_response(schedule)


@router.delete("/{schedule_id}", response_model=StatusResponse)
def delete_schedule(schedule_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    schedule = db.get(Schedule, schedule_id)
    if not schedule or schedule.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Schedule not found")
    db.delete(schedule)
    db.commit()
    return StatusResponse(message="Schedule deleted")
