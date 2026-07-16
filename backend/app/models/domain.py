from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def now_utc() -> datetime:
    return datetime.now(UTC)


class Tenant(Base):
    __tablename__ = "tenants"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    plan_code: Mapped[str] = mapped_column(String(40), default="starter", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    tenant: Mapped[Tenant] = relationship()


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    family_id: Mapped[str] = mapped_column(String(36), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    __table_args__ = (Index("ix_password_reset_tokens_user_expires", "user_id", "expires_at"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"
    __table_args__ = (Index("ix_email_verification_tokens_user_expires", "user_id", "expires_at"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class OnboardingState(Base):
    __tablename__ = "onboarding_states"
    __table_args__ = (UniqueConstraint("tenant_id", "user_id", name="uq_onboarding_state_per_user"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    current_step: Mapped[str] = mapped_column(String(80), default="verify_email", nullable=False)
    completed_steps: Mapped[list] = mapped_column(JSON, default=list)
    demo_viewed: Mapped[bool] = mapped_column(Boolean, default=False)
    first_project_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (Index("ix_projects_tenant_active", "tenant_id", "is_active"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (Index("ix_devices_tenant_active", "tenant_id", "is_active"), UniqueConstraint("tenant_id", "name", name="uq_device_name_per_tenant"))
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    board: Mapped[str] = mapped_column(String(80), default="ESP32")
    secret_hash: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Dashboard(Base):
    __tablename__ = "dashboards"
    __table_args__ = (UniqueConstraint("tenant_id", "project_id", name="uq_dashboard_per_project"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    widgets: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class DeviceTemplateRecord(Base):
    __tablename__ = "device_templates"
    __table_args__ = (
        Index("ix_device_templates_tenant_project", "tenant_id", "project_id"),
        UniqueConstraint("tenant_id", "project_id", name="uq_template_per_project"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    dashboard_id: Mapped[str] = mapped_column(String(36), ForeignKey("dashboards.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    board: Mapped[str] = mapped_column(String(80), default="ESP32", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    revision: Mapped[int] = mapped_column(Integer, default=1)
    datastreams: Mapped[list] = mapped_column(JSON, default=list)
    notifications: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Telemetry(Base):
    __tablename__ = "telemetry"
    __table_args__ = (
        Index("ix_telemetry_tenant_device_channel_time", "tenant_id", "device_id", "channel", "observed_at"),
        Index(
            "uq_telemetry_message_retry",
            "tenant_id",
            "device_id",
            "channel",
            "message_id",
            unique=True,
            postgresql_where=text("message_id IS NOT NULL"),
            sqlite_where=text("message_id IS NOT NULL"),
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    device_id: Mapped[str] = mapped_column(String(36), ForeignKey("devices.id"), nullable=False)
    channel: Mapped[str] = mapped_column(String(120), nullable=False)
    value: Mapped[dict] = mapped_column(JSON, nullable=False)
    unit: Mapped[str | None] = mapped_column(String(40), nullable=True)
    message_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    server_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class AlertRule(Base):
    __tablename__ = "alert_rules"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    device_id: Mapped[str] = mapped_column(String(36), ForeignKey("devices.id"), nullable=False)
    channel: Mapped[str] = mapped_column(String(120), nullable=False)
    operator: Mapped[str] = mapped_column(String(8), nullable=False)
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    cooldown_seconds: Mapped[int] = mapped_column(Integer, default=300)
    last_triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_tenant_created", "tenant_id", "created_at"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    keys: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Schedule(Base):
    __tablename__ = "schedules"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    device_id: Mapped[str] = mapped_column(String(36), ForeignKey("devices.id"), nullable=False)
    channel: Mapped[str] = mapped_column(String(120), nullable=False)
    command_value: Mapped[dict] = mapped_column(JSON, nullable=False)
    timezone: Mapped[str] = mapped_column(String(80), default="Asia/Kuala_Lumpur")
    time_of_day: Mapped[str] = mapped_column(String(8), nullable=False)
    recurrence: Mapped[str] = mapped_column(String(20), default="daily")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class CommandLog(Base):
    __tablename__ = "command_logs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False)
    device_id: Mapped[str] = mapped_column(String(36), ForeignKey("devices.id"), nullable=False)
    channel: Mapped[str] = mapped_column(String(120), nullable=False)
    value: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="queued")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
