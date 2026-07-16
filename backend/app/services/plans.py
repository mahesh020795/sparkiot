from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.domain import Device, Project, Tenant, User


@dataclass(frozen=True)
class PlanDefinition:
    code: str
    name: str
    monthly_price_rm: int | None
    max_users: int
    max_devices: int
    max_projects: int
    max_widgets: int
    retention_days: int
    features: tuple[str, ...]


PLAN_CATALOG: dict[str, PlanDefinition] = {
    "free": PlanDefinition(
        code="free",
        name="Free",
        monthly_price_rm=0,
        max_users=1,
        max_devices=1,
        max_projects=1,
        max_widgets=6,
        retention_days=7,
        features=("1 project", "1 device", "7-day data", "Basic dashboard widgets"),
    ),
    "plus": PlanDefinition(
        code="plus",
        name="Plus",
        monthly_price_rm=25,
        max_users=1,
        max_devices=3,
        max_projects=3,
        max_widgets=18,
        retention_days=30,
        features=("3 projects", "3 devices", "GPS", "Camera URL", "Browser push", "30-day history"),
    ),
    "pro": PlanDefinition(
        code="pro",
        name="Pro",
        monthly_price_rm=49,
        max_users=3,
        max_devices=10,
        max_projects=10,
        max_widgets=30,
        retention_days=90,
        features=("10 projects", "10 devices", "Advanced dashboards", "90-day history", "Priority support"),
    ),
    "enterprise": PlanDefinition(
        code="enterprise",
        name="Enterprise",
        monthly_price_rm=None,
        max_users=9999,
        max_devices=9999,
        max_projects=9999,
        max_widgets=9999,
        retention_days=365,
        features=("Custom limits", "White label", "Private deployment", "SLA-ready support"),
    ),
}

LEGACY_PLAN_ALIASES = {"starter": "plus"}


class PlanLimitError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


def normalize_plan_code(plan_code: str | None) -> str:
    normalized = (plan_code or "free").strip().lower()
    return LEGACY_PLAN_ALIASES.get(normalized, normalized)


def get_plan(plan_code: str | None) -> PlanDefinition:
    return PLAN_CATALOG.get(normalize_plan_code(plan_code), PLAN_CATALOG["free"])


def tenant_plan(db: Session, tenant_id: str) -> PlanDefinition:
    tenant = db.get(Tenant, tenant_id)
    return get_plan(tenant.plan_code if tenant else None)


def usage(db: Session, tenant_id: str) -> dict[str, object]:
    plan = tenant_plan(db, tenant_id)
    users = db.scalar(select(func.count()).select_from(User).where(User.tenant_id == tenant_id, User.is_active)) or 0
    devices = db.scalar(select(func.count()).select_from(Device).where(Device.tenant_id == tenant_id, Device.is_active)) or 0
    projects = db.scalar(select(func.count()).select_from(Project).where(Project.tenant_id == tenant_id, Project.is_active)) or 0
    return {
        "plan_code": plan.code,
        "plan_name": plan.name,
        "monthly_price_rm": plan.monthly_price_rm,
        "users": users,
        "max_users": plan.max_users,
        "devices": devices,
        "max_devices": plan.max_devices,
        "projects": projects,
        "max_projects": plan.max_projects,
        "max_widgets": plan.max_widgets,
        "retention_days": plan.retention_days,
        "features": list(plan.features),
    }


def assert_can_create_project(db: Session, tenant_id: str) -> None:
    data = usage(db, tenant_id)
    if data["projects"] >= data["max_projects"]:
        raise PlanLimitError("plan_project_limit", f"{data['plan_name']} plan allows {data['max_projects']} active projects")


def assert_can_create_device(db: Session, tenant_id: str) -> None:
    data = usage(db, tenant_id)
    if data["devices"] >= data["max_devices"]:
        raise PlanLimitError("plan_device_limit", f"{data['plan_name']} plan allows {data['max_devices']} active devices")
