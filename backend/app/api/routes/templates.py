from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.database import get_db
from app.models.domain import Dashboard, DeviceTemplateRecord, Project, User
from app.schemas.api import TemplateStudioResponse, TemplateStudioUpdate

router = APIRouter(prefix="/templates", tags=["templates"])


def template_payload(template: DeviceTemplateRecord, dashboard: Dashboard) -> dict:
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


def _tenant_dashboard(db: Session, tenant_id: str, dashboard_id: str, project_id: str) -> Dashboard:
    dashboard = db.get(Dashboard, dashboard_id)
    if not dashboard or dashboard.tenant_id != tenant_id or dashboard.project_id != project_id:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboard


def _tenant_project(db: Session, tenant_id: str, project_id: str) -> Project:
    project = db.get(Project, project_id)
    if not project or project.tenant_id != tenant_id or not project.is_active:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _get_tenant_template(db: Session, tenant_id: str, template_id: str) -> tuple[DeviceTemplateRecord, Dashboard]:
    template = db.get(DeviceTemplateRecord, template_id)
    if not template or template.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Template not found")
    dashboard = db.get(Dashboard, template.dashboard_id)
    if not dashboard or dashboard.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Template dashboard not found")
    return template, dashboard


@router.get("", response_model=list[TemplateStudioResponse])
def list_templates(user: User = Depends(current_user), db: Session = Depends(get_db)):
    templates = db.scalars(
        select(DeviceTemplateRecord)
        .where(DeviceTemplateRecord.tenant_id == user.tenant_id)
        .order_by(DeviceTemplateRecord.created_at.asc())
    ).all()
    dashboards = {
        dashboard.id: dashboard
        for dashboard in db.scalars(select(Dashboard).where(Dashboard.tenant_id == user.tenant_id)).all()
    }
    return [template_payload(template, dashboards[template.dashboard_id]) for template in templates if template.dashboard_id in dashboards]


@router.get("/{template_id}", response_model=TemplateStudioResponse)
def get_template(template_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    template, dashboard = _get_tenant_template(db, user.tenant_id, template_id)
    return template_payload(template, dashboard)


@router.post("", response_model=TemplateStudioResponse, status_code=201)
def create_template(payload: TemplateStudioUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _tenant_project(db, user.tenant_id, payload.dashboard.project_id)
    dashboard = _tenant_dashboard(db, user.tenant_id, payload.dashboard.id, payload.dashboard.project_id)
    existing = db.scalar(
        select(DeviceTemplateRecord).where(
            DeviceTemplateRecord.tenant_id == user.tenant_id,
            DeviceTemplateRecord.project_id == payload.dashboard.project_id,
        )
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"code": "template_project_exists", "message": "Starter plan allows one template per project"},
        )
    if payload.dashboard.revision != dashboard.revision:
        raise HTTPException(
            status_code=409,
            detail={"code": "stale_dashboard_revision", "message": "Dashboard was updated elsewhere. Refresh before saving again."},
        )

    template = DeviceTemplateRecord(
        tenant_id=user.tenant_id,
        project_id=payload.dashboard.project_id,
        dashboard_id=dashboard.id,
        name=payload.name,
        board=payload.board,
        description=payload.description,
        revision=1,
        datastreams=[stream.model_dump(exclude_none=True) for stream in payload.datastreams],
        notifications=[rule.model_dump(exclude_none=True) for rule in payload.notifications],
    )
    dashboard.name = payload.dashboard.name
    dashboard.widgets = payload.dashboard.widgets
    dashboard.updated_at = datetime.now(UTC)
    db.add(template)
    db.commit()
    db.refresh(template)
    db.refresh(dashboard)
    return template_payload(template, dashboard)


@router.put("/{template_id}", response_model=TemplateStudioResponse)
def update_template(template_id: str, payload: TemplateStudioUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    template, dashboard = _get_tenant_template(db, user.tenant_id, template_id)
    if payload.revision != template.revision:
        raise HTTPException(
            status_code=409,
            detail={"code": "stale_template_revision", "message": "Template was updated elsewhere. Refresh before saving again."},
        )
    if payload.dashboard.id != dashboard.id or payload.dashboard.project_id != template.project_id:
        raise HTTPException(status_code=400, detail="Dashboard does not belong to this template")
    if payload.dashboard.revision != dashboard.revision:
        raise HTTPException(
            status_code=409,
            detail={"code": "stale_dashboard_revision", "message": "Dashboard was updated elsewhere. Refresh before saving again."},
        )

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
    return template_payload(template, dashboard)
