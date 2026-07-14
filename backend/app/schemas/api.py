from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, HttpUrl, field_validator


class RegisterRequest(BaseModel):
    tenant_name: str = Field(min_length=2, max_length=160)
    full_name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    tenant_id: str
    email: str
    full_name: str
    plan_code: str


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str = ""


class ProjectResponse(ProjectCreate):
    id: str
    is_active: bool


class DeviceCreate(BaseModel):
    project_id: str
    name: str = Field(min_length=2, max_length=160)
    board: str = "ESP32"


class DeviceResponse(BaseModel):
    id: str
    project_id: str
    name: str
    board: str
    is_online: bool
    last_seen_at: datetime | None
    token: str | None = None
    telemetry_topic: str
    command_topic: str


class DashboardUpdate(BaseModel):
    revision: int
    widgets: list[dict[str, Any]]

    @field_validator("widgets")
    @classmethod
    def validate_widgets(cls, widgets: list[dict[str, Any]]) -> list[dict[str, Any]]:
        allowed = {"gauge", "meter", "value", "led", "text", "push_button", "switch", "slider", "chart", "gps", "camera", "date", "time", "day", "serial_lcd", "battery", "signal"}
        if len(widgets) > 10:
            raise ValueError("Starter plan allows 10 widgets per dashboard")
        for widget in widgets:
            if widget.get("type") not in allowed:
                raise ValueError(f"Unsupported widget type: {widget.get('type')}")
            for key in ("id", "title", "type", "x", "y", "w", "h"):
                if key not in widget:
                    raise ValueError(f"Widget missing {key}")
        return widgets


class DashboardResponse(BaseModel):
    id: str
    project_id: str
    name: str
    revision: int
    widgets: list[dict[str, Any]]


class TelemetryIngestRequest(BaseModel):
    device_id: str
    token: str
    channel: str = Field(min_length=1, max_length=120)
    value: Any
    unit: str | None = None
    ts: datetime | None = None
    quality: dict[str, Any] = Field(default_factory=dict)
    message_id: str | None = None


class TelemetryResponse(BaseModel):
    id: str
    device_id: str
    channel: str
    value: Any
    unit: str | None
    observed_at: datetime
    server_at: datetime


class CommandRequest(BaseModel):
    channel: str = Field(min_length=1, max_length=120)
    value: Any


class NotificationCreate(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    body: str = Field(min_length=2)


class NotificationResponse(BaseModel):
    id: str
    title: str
    body: str
    read: bool
    created_at: datetime


class PushSubscriptionCreate(BaseModel):
    endpoint: HttpUrl
    keys: dict[str, str]


class AlertRuleCreate(BaseModel):
    project_id: str
    device_id: str
    channel: str
    operator: Literal[">", ">=", "<", "<=", "=="]
    threshold: float
    cooldown_seconds: int = Field(default=300, ge=30, le=86400)


class UsageResponse(BaseModel):
    users: int
    max_users: int
    devices: int
    max_devices: int
    projects: int
    max_projects: int
    retention_days: int
