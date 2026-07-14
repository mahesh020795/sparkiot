from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.domain import Device, Project, User


class PlanLimitError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


def usage(db: Session, tenant_id: str) -> dict[str, int]:
    settings = get_settings()
    users = db.scalar(select(func.count()).select_from(User).where(User.tenant_id == tenant_id, User.is_active)) or 0
    devices = db.scalar(select(func.count()).select_from(Device).where(Device.tenant_id == tenant_id, Device.is_active)) or 0
    projects = db.scalar(select(func.count()).select_from(Project).where(Project.tenant_id == tenant_id, Project.is_active)) or 0
    return {"users": users, "max_users": settings.starter_max_users, "devices": devices, "max_devices": settings.starter_max_devices, "projects": projects, "max_projects": settings.starter_max_projects, "retention_days": settings.starter_retention_days}


def assert_can_create_project(db: Session, tenant_id: str) -> None:
    data = usage(db, tenant_id)
    if data["projects"] >= data["max_projects"]:
        raise PlanLimitError("plan_project_limit", "Starter plan allows 3 active projects")


def assert_can_create_device(db: Session, tenant_id: str) -> None:
    data = usage(db, tenant_id)
    if data["devices"] >= data["max_devices"]:
        raise PlanLimitError("plan_device_limit", "Starter plan allows 3 active devices")
