from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.database import get_db
from app.models.domain import Dashboard, User
from app.schemas.api import DashboardResponse, DashboardUpdate

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


@router.get("/project/{project_id}", response_model=DashboardResponse)
def get_project_dashboard(project_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    dashboard = db.scalar(select(Dashboard).where(Dashboard.tenant_id == user.tenant_id, Dashboard.project_id == project_id))
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboard


@router.put("/{dashboard_id}", response_model=DashboardResponse)
def update_dashboard(dashboard_id: str, payload: DashboardUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    dashboard = db.get(Dashboard, dashboard_id)
    if not dashboard or dashboard.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    if dashboard.revision != payload.revision:
        raise HTTPException(status_code=409, detail={"code": "stale_dashboard_revision", "message": "Dashboard was updated elsewhere"})
    dashboard.widgets = payload.widgets
    dashboard.revision += 1
    dashboard.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(dashboard)
    return dashboard
