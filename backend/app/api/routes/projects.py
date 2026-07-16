from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.database import get_db
from app.models.domain import Dashboard, Device, DeviceTemplateRecord, Project, User
from app.schemas.api import ProjectCreate, ProjectResponse, ProjectUpdate, StatusResponse
from app.services.plans import PlanLimitError, assert_can_create_project

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
def list_projects(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Project).where(Project.tenant_id == user.tenant_id, Project.is_active)).all()


@router.post("", response_model=ProjectResponse, status_code=201)
def create_project(payload: ProjectCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    try:
        assert_can_create_project(db, user.tenant_id)
    except PlanLimitError as exc:
        raise HTTPException(status_code=409, detail={"code": exc.code, "message": str(exc)}) from exc
    project = Project(tenant_id=user.tenant_id, name=payload.name, description=payload.description)
    db.add(project)
    db.flush()
    db.add(Dashboard(tenant_id=user.tenant_id, project_id=project.id, name=f"{project.name} Dashboard", widgets=[]))
    db.commit()
    db.refresh(project)
    return project


def _tenant_project(project_id: str, user: User, db: Session) -> Project:
    project = db.get(Project, project_id)
    if not project or project.tenant_id != user.tenant_id or not project.is_active:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: str, payload: ProjectUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    project = _tenant_project(project_id, user, db)
    project.name = payload.name
    project.description = payload.description
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", response_model=StatusResponse)
def delete_project(project_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    project = _tenant_project(project_id, user, db)
    project.is_active = False
    for device in db.scalars(select(Device).where(Device.tenant_id == user.tenant_id, Device.project_id == project_id)).all():
        device.is_active = False
    for template in db.scalars(select(DeviceTemplateRecord).where(DeviceTemplateRecord.tenant_id == user.tenant_id, DeviceTemplateRecord.project_id == project_id)).all():
        db.delete(template)
    db.commit()
    return StatusResponse(message="Project archived")
