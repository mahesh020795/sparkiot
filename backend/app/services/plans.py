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
    message_quota_monthly: int | None
    automation_limit: int | None
    max_widgets: int
    retention_days: int
    features: tuple[str, ...]
    widget_groups: tuple[str, ...]
    support: str


PLAN_CATALOG: dict[str, PlanDefinition] = {
    "free": PlanDefinition(
        code="free",
        name="Free",
        monthly_price_rm=0,
        max_users=1,
        max_devices=1,
        max_projects=1,
        message_quota_monthly=40_000,
        automation_limit=0,
        max_widgets=10,
        retention_days=7,
        features=("1 project", "1 device", "40,000 messages/month", "7-day data retention", "Core widgets", "Web dashboard", "Mobile dashboard", "Spark IoT branding"),
        widget_groups=("Core widgets",),
        support="Community support",
    ),
    "plus": PlanDefinition(
        code="plus",
        name="Plus",
        monthly_price_rm=25,
        max_users=1,
        max_devices=3,
        max_projects=3,
        message_quota_monthly=1_000_000,
        automation_limit=5,
        max_widgets=18,
        retention_days=30,
        features=("3 projects", "3 devices", "1,000,000 messages/month", "30-day data retention", "5 automations", "Core and smart widgets", "GPS map", "Camera", "Web dashboard", "Mobile dashboard"),
        widget_groups=("Core widgets", "Smart widgets"),
        support="Standard support",
    ),
    "pro": PlanDefinition(
        code="pro",
        name="Pro",
        monthly_price_rm=49,
        max_users=1,
        max_devices=10,
        max_projects=10,
        message_quota_monthly=10_000_000,
        automation_limit=20,
        max_widgets=30,
        retention_days=90,
        features=("10 projects", "10 devices", "10,000,000 messages/month", "90-day data retention", "20 automations", "Core, smart and advanced widgets", "Full API access", "Priority support", "Web dashboard", "Mobile dashboard"),
        widget_groups=("Core widgets", "Smart widgets", "Advanced widgets"),
        support="Priority support",
    ),
    "max": PlanDefinition(
        code="max",
        name="Max",
        monthly_price_rm=99,
        max_users=10,
        max_devices=30,
        max_projects=30,
        message_quota_monthly=50_000_000,
        automation_limit=100,
        max_widgets=60,
        retention_days=365,
        features=("30 projects", "30 devices", "10 users", "50,000,000 messages/month", "365-day data retention", "100 automations", "Team collaboration", "User roles and permissions", "Advanced OTA management", "Fleet device management"),
        widget_groups=("Core widgets", "Smart widgets", "Advanced widgets"),
        support="Priority support",
    ),
    "enterprise": PlanDefinition(
        code="enterprise",
        name="Enterprise",
        monthly_price_rm=None,
        max_users=9999,
        max_devices=9999,
        max_projects=9999,
        message_quota_monthly=None,
        automation_limit=None,
        max_widgets=9999,
        retention_days=365,
        features=("Custom device limit", "Custom project limit", "Custom user limit", "Custom message quota", "Custom data retention", "Unlimited automations", "All widgets", "White-label platform", "Custom domain", "Advanced security", "SLA and dedicated support"),
        widget_groups=("All widgets",),
        support="Dedicated technical support",
    ),
}

LEGACY_PLAN_ALIASES = {"starter": "plus"}


class PlanLimitError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


def normalize_plan_code(plan_code: str | None) -> str:
    normalized = (plan_code or "pro").strip().lower()
    return LEGACY_PLAN_ALIASES.get(normalized, normalized)


def get_plan(plan_code: str | None) -> PlanDefinition:
    return PLAN_CATALOG.get(normalize_plan_code(plan_code), PLAN_CATALOG["pro"])


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
        "message_quota_monthly": plan.message_quota_monthly,
        "automation_limit": plan.automation_limit,
        "max_widgets": plan.max_widgets,
        "retention_days": plan.retention_days,
        "features": list(plan.features),
        "widget_groups": list(plan.widget_groups),
        "support": plan.support,
    }


def assert_can_create_project(db: Session, tenant_id: str) -> None:
    data = usage(db, tenant_id)
    if data["projects"] >= data["max_projects"]:
        raise PlanLimitError("plan_project_limit", f"{data['plan_name']} plan allows {data['max_projects']} active projects")


def assert_can_create_device(db: Session, tenant_id: str) -> None:
    data = usage(db, tenant_id)
    if data["devices"] >= data["max_devices"]:
        raise PlanLimitError("plan_device_limit", f"{data['plan_name']} plan allows {data['max_devices']} active devices")
