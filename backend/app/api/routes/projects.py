from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.database import get_db
from app.models.domain import Dashboard, Project, User
from app.schemas.api import ProjectCreate, ProjectResponse
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
