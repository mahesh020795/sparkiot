from datetime import datetime
from typing import Any, Literal

from email_validator import EmailNotValidError, validate_email as validate_email_address
from pydantic import BaseModel, Field, HttpUrl, field_validator

from app.core.config import get_settings


def validate_email(value: str) -> str:
    email = value.strip()
    try:
        result = validate_email_address(
            email,
            check_deliverability=False,
            test_environment=True,
        )
    except EmailNotValidError as exc:
        raise ValueError("Invalid email address") from exc
    if not result.normalized:
        raise ValueError("Invalid email address")
    return result.normalized


class RegisterRequest(BaseModel):
    tenant_name: str = Field(min_length=2, max_length=160)
    full_name: str = Field(min_length=2, max_length=160)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_register_email(cls, email: str) -> str:
        return validate_email(email)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str

    @field_validator("email")
    @classmethod
    def validate_login_email(cls, email: str) -> str:
        return validate_email(email)


class PasswordResetRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)

    @field_validator("email")
    @classmethod
    def validate_password_reset_email(cls, email: str) -> str:
        return validate_email(email)


class PasswordResetConfirmRequest(BaseModel):
    token: str = Field(min_length=24, max_length=256)
    password: str = Field(min_length=8, max_length=128)


class EmailVerificationConfirmRequest(BaseModel):
    token: str = Field(min_length=24, max_length=256)


class StatusResponse(BaseModel):
    status: str = "ok"
    message: str
    reset_token: str | None = None
    verification_token: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    verification_token: str | None = None


class UserResponse(BaseModel):
    id: str
    tenant_id: str
    email: str
    full_name: str
    plan_code: str
    email_verified: bool
    onboarding_step: str


class OnboardingResponse(BaseModel):
    current_step: str
    completed_steps: list[str]
    demo_viewed: bool
    first_project_id: str | None = None


class OnboardingUpdate(BaseModel):
    current_step: str = Field(min_length=2, max_length=80)
    completed_steps: list[str] = Field(default_factory=list, max_length=20)
    demo_viewed: bool = False
    first_project_id: str | None = Field(default=None, max_length=36)


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str = ""


class ProjectUpdate(ProjectCreate):
    pass


class ProjectResponse(ProjectCreate):
    id: str
    is_active: bool


class DeviceCreate(BaseModel):
    project_id: str
    name: str = Field(min_length=2, max_length=160)
    board: str = "ESP32"


class DeviceUpdate(DeviceCreate):
    pass


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
        allowed = {"gauge", "meter", "value", "led", "text", "push_button", "switch", "slider", "chart", "gps", "camera", "date", "time", "day", "serial_lcd", "battery", "signal", "schedule", "power_hub", "event_monitor"}
        max_widgets = get_settings().starter_max_widgets
        if len(widgets) > max_widgets:
            raise ValueError(f"Current plan allows {max_widgets} widgets per dashboard")
        for widget in widgets:
            if widget.get("type") not in allowed:
                raise ValueError(f"Unsupported widget type: {widget.get('type')}")
            for key in ("id", "title", "type", "x", "y", "w", "h"):
                if key not in widget:
                    raise ValueError(f"Widget missing {key}")
            if widget.get("type") == "schedule":
                validate_schedule_widget(widget)
        return widgets


class DashboardResponse(BaseModel):
    id: str
    project_id: str
    name: str
    revision: int
    widgets: list[dict[str, Any]]


def validate_schedule_widget(widget: dict[str, Any]) -> None:
    allowed_days = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
    days = widget.get("days")
    if days is not None:
        if not isinstance(days, list) or not days or len(days) > 7 or any(day not in allowed_days for day in days):
            raise ValueError("Schedule widget days must use mon/tue/wed/thu/fri/sat/sun")

    max_time_slots = widget.get("maxTimeSlots", len(widget.get("timeSlots", [])) or 3)
    if not isinstance(max_time_slots, int) or max_time_slots < 1 or max_time_slots > 6:
        raise ValueError("Schedule widget maxTimeSlots must be between 1 and 6")

    time_slots = widget.get("timeSlots")
    if time_slots is not None:
        if not isinstance(time_slots, list) or not time_slots or len(time_slots) > max_time_slots:
            raise ValueError("Schedule widget timeSlots must fit maxTimeSlots")
        for slot in time_slots:
            if not isinstance(slot, str):
                raise ValueError("Schedule widget timeSlots must be HH:MM strings")
            try:
                datetime.strptime(slot, "%H:%M")
            except ValueError as exc:
                raise ValueError("Schedule widget timeSlots must be valid HH:MM values") from exc


class DatastreamDefinition(BaseModel):
    id: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    pin: str = Field(pattern=r"^V([0-9]|[1-5][0-9]|6[0-3])$")
    dataType: Literal["integer", "float", "string", "boolean", "gps", "image", "time", "date"]
    unit: str | None = Field(default="", max_length=24)
    min: float | None = None
    max: float | None = None
    color: str = Field(default="#2563eb", pattern=r"^#[0-9a-fA-F]{6}$")

    @field_validator("max")
    @classmethod
    def validate_range(cls, max_value: float | None, info):
        min_value = info.data.get("min")
        if max_value is not None and min_value is not None and max_value < min_value:
            raise ValueError("Datastream max must be greater than or equal to min")
        return max_value


class TemplateNotificationDefinition(BaseModel):
    id: str = Field(min_length=2, max_length=100)
    name: str = Field(min_length=1, max_length=120)
    datastreamId: str = Field(min_length=2, max_length=80)
    operator: Literal[">", ">=", "<", "<=", "==", "changes"]
    threshold: float | None = None
    channel: Literal["push", "in_app", "email"]
    cooldownMinutes: int = Field(ge=1, le=1440)


class TemplateDashboardPayload(BaseModel):
    id: str
    project_id: str
    name: str
    revision: int
    widgets: list[dict[str, Any]]

    @field_validator("widgets")
    @classmethod
    def validate_template_widgets(cls, widgets: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return DashboardUpdate(revision=1, widgets=widgets).widgets


class TemplateStudioUpdate(BaseModel):
    revision: int
    name: str = Field(min_length=2, max_length=160)
    board: Literal["ESP32", "ESP8266", "Arduino", "Raspberry Pi Pico", "STM32"]
    description: str = Field(default="", max_length=500)
    datastreams: list[DatastreamDefinition] = Field(min_length=1, max_length=64)
    notifications: list[TemplateNotificationDefinition] = Field(default_factory=list, max_length=20)
    dashboard: TemplateDashboardPayload

    @field_validator("datastreams")
    @classmethod
    def validate_unique_virtual_pins(cls, streams: list[DatastreamDefinition]) -> list[DatastreamDefinition]:
        pins = [stream.pin for stream in streams]
        if len(pins) != len(set(pins)):
            raise ValueError("Virtual pins must be unique")
        ids = [stream.id for stream in streams]
        if len(ids) != len(set(ids)):
            raise ValueError("Datastream IDs must be unique")
        return streams

    @field_validator("notifications")
    @classmethod
    def validate_notification_targets(cls, notifications: list[TemplateNotificationDefinition], info):
        stream_ids = {stream.id for stream in info.data.get("datastreams", [])}
        for rule in notifications:
            if rule.datastreamId not in stream_ids:
                raise ValueError(f"Notification {rule.id} references an unknown datastream")
        return notifications


class TemplateStudioResponse(BaseModel):
    id: str
    name: str
    board: str
    description: str
    revision: int
    datastreams: list[dict[str, Any]]
    notifications: list[dict[str, Any]]
    dashboard: DashboardResponse


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
    project_id: str
    device_id: str
    channel: str
    value: Any
    unit: str | None
    observed_at: datetime
    server_at: datetime


class CommandRequest(BaseModel):
    channel: str = Field(min_length=1, max_length=120)
    value: Any


class ScheduleCreate(BaseModel):
    project_id: str
    device_id: str
    channel: str = Field(min_length=1, max_length=120)
    value: Any
    time_of_day: str = Field(pattern=r"^\d{2}:\d{2}$")
    recurrence: str = Field(default="daily", max_length=20)
    timezone: str = Field(default="Asia/Kuala_Lumpur", max_length=80)
    is_active: bool = True

    @field_validator("time_of_day")
    @classmethod
    def validate_time_of_day(cls, value: str) -> str:
        hour, minute = [int(part) for part in value.split(":")]
        if hour > 23 or minute > 59:
            raise ValueError("time_of_day must be a valid HH:MM value")
        return value

    @field_validator("recurrence")
    @classmethod
    def validate_recurrence(cls, value: str) -> str:
        normalized = value.strip().lower()
        allowed = {"daily", "weekdays", "weekends", "mon", "tue", "wed", "thu", "fri", "sat", "sun"}
        parts = normalized.split(",")
        if not parts or any(part not in allowed for part in parts):
            raise ValueError("recurrence must be daily, weekdays, weekends, or comma-separated mon/tue/wed/thu/fri/sat/sun")
        if len(parts) > 1 and any(part in {"daily", "weekdays", "weekends"} for part in parts):
            raise ValueError("daily, weekdays, and weekends cannot be combined with specific days")
        return normalized


class ScheduleResponse(BaseModel):
    id: str
    project_id: str
    device_id: str
    channel: str
    value: Any
    time_of_day: str
    recurrence: str
    timezone: str
    is_active: bool


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
    plan_code: str
    plan_name: str
    monthly_price_rm: int | None
    users: int
    max_users: int
    devices: int
    max_devices: int
    projects: int
    max_projects: int
    max_widgets: int
    retention_days: int
    features: list[str]
