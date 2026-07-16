from app.services.mqtt import command_topic, parse_topic, telemetry_topic
from app.services.mqtt_bridge import build_ack_log_payload, build_ingest_request, is_successful_connect, telemetry_event_payload
from app.services.telemetry import evaluate_alerts, ingest, normalize_value
from app.services.schedules import due_occurrence_key, run_due_schedules_once
from app.services.demo_live import build_board_test_payload, build_demo_command_response, build_history_csv, history_row_payload
from app.services.plans import usage
from app.schemas.api import EmailVerificationConfirmRequest, OnboardingUpdate, PasswordResetConfirmRequest, PasswordResetRequest, RegisterRequest, ScheduleCreate, TelemetryIngestRequest, TemplateStudioUpdate
from app.core.database import Base, ensure_runtime_indexes, make_engine
from app.core.security import create_access_token, hash_secret, verify_secret
from app.models.domain import AlertRule, CommandLog, Dashboard, Device, DeviceTemplateRecord, EmailVerificationToken, Notification, OnboardingState, PasswordResetToken, Project, RefreshToken, Schedule, Telemetry, Tenant, User
from app.api.routes.auth import confirm_email_verification, confirm_password_reset, me, register, request_password_reset, resend_email_verification
from app.api.routes.onboarding import get_onboarding, update_onboarding
from app.api.routes.templates import create_template, list_templates, update_template
from app.api.routes.devices import command_logs
from app.api.routes.schedules import delete_schedule
from app.api.routes.notifications import mark_notification_read
from app.api.routes.realtime import realtime_subscription_scope
from app.api.routes.telemetry import history_csv
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text
from datetime import UTC, datetime
from pathlib import Path
import pytest


ROOT = Path(__file__).resolve().parents[2]


def memory_session():
    engine = make_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    return Session()


def test_register_creates_unverified_user_email_token_and_onboarding_state():
    db = memory_session()
    response = register(RegisterRequest(
        tenant_name="Acme Farm",
        full_name="Acme Owner",
        email="owner@acme.test",
        password="SparkDemo123!",
    ), db)
    assert response.access_token

    user = db.scalar(select(User).where(User.email == "owner@acme.test"))
    assert user is not None
    assert user.email_verified_at is None

    token = db.scalar(select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id))
    assert token is not None
    assert token.used_at is None
    assert len(token.token_hash) == 64

    state = db.scalar(select(OnboardingState).where(OnboardingState.user_id == user.id))
    assert state is not None
    assert state.current_step == "verify_email"
    assert state.completed_steps == []
    assert state.demo_viewed is False
    assert state.first_project_id is None


def test_email_verification_confirms_user_and_advances_onboarding():
    db = memory_session()
    register_response = register(RegisterRequest(
        tenant_name="Acme Farm",
        full_name="Acme Owner",
        email="verify@acme.test",
        password="SparkDemo123!",
    ), db)
    user = db.scalar(select(User).where(User.email == "verify@acme.test"))
    resend_response = resend_email_verification(user=user, db=db)

    assert resend_response.verification_token
    confirm_response = confirm_email_verification(EmailVerificationConfirmRequest(token=resend_response.verification_token), db=db)
    assert confirm_response.status == "ok"

    db.refresh(user)
    state = db.scalar(select(OnboardingState).where(OnboardingState.user_id == user.id))
    assert user.email_verified_at is not None
    assert state.current_step == "starter_workspace"
    assert "verify_email" in state.completed_steps

    me_response = me(user=user, db=db)
    assert me_response.email_verified is True
    assert me_response.onboarding_step == "starter_workspace"
    assert register_response.access_token


def test_onboarding_state_can_mark_demo_viewed_and_first_project():
    db = memory_session()
    register(RegisterRequest(
        tenant_name="Lab",
        full_name="Lab Owner",
        email="lab@example.test",
        password="SparkDemo123!",
    ), db)
    user = db.scalar(select(User).where(User.email == "lab@example.test"))
    confirm = resend_email_verification(user=user, db=db)
    confirm_email_verification(EmailVerificationConfirmRequest(token=confirm.verification_token), db=db)

    updated = update_onboarding(OnboardingUpdate(
        current_step="project",
        completed_steps=["verify_email", "starter_workspace"],
        demo_viewed=True,
        first_project_id="project-123",
    ), user=user, db=db)

    assert updated.current_step == "project"
    assert updated.demo_viewed is True
    assert updated.first_project_id == "project-123"


def test_auth_email_validation_allows_test_domains_but_rejects_bad_syntax():
    assert RegisterRequest(
        tenant_name="Acme Farm",
        full_name="Acme Owner",
        email="owner@acme.test",
        password="SparkDemo123!",
    ).email == "owner@acme.test"

    invalid_emails = [
        "a b@example.com",
        "foo@@bar.com",
        "foo@.com",
        "foo@bar.",
        "foo@bar..com",
        "foo@-bar.com",
    ]
    for email in invalid_emails:
        with pytest.raises(ValueError):
            RegisterRequest(
                tenant_name="Acme Farm",
                full_name="Acme Owner",
                email=email,
                password="SparkDemo123!",
            )


def test_runtime_upgrade_adds_email_verified_column_to_existing_sqlite_users_table():
    engine = make_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(text("create table telemetry (tenant_id varchar, device_id varchar, channel varchar, message_id varchar)"))
        connection.execute(text("create table users (id varchar primary key, tenant_id varchar, email varchar)"))

    ensure_runtime_indexes(engine)

    with engine.begin() as connection:
        columns = [row[1] for row in connection.execute(text("pragma table_info(users)")).fetchall()]

    assert "email_verified_at" in columns


def test_topic_helpers_create_spark_namespace():
    assert telemetry_topic("tenant-1", "device-1", "temperature") == "spark/v1/tenant-1/device-1/telemetry/temperature"


def test_register_creates_free_tenant_user_refresh_token_and_welcome_notification():
    db = memory_session()

    response = register(
        RegisterRequest(
            tenant_name="Rectronx Lab",
            full_name="Mahesh Rajagopal",
            email="MAHESH@EXAMPLE.COM",
            password="SparkDemo123!",
        ),
        db,
    )

    tenant = db.scalar(select(Tenant).where(Tenant.name == "Rectronx Lab"))
    assert tenant is not None
    assert tenant.plan_code == "free"
    user = db.scalar(select(User).where(User.email == "mahesh@example.com"))
    assert user is not None
    assert user.tenant_id == tenant.id
    assert user.full_name == "Mahesh Rajagopal"
    assert user.password_hash != "SparkDemo123!"
    assert response.access_token
    assert response.refresh_token
    assert db.scalar(select(RefreshToken).where(RefreshToken.user_id == user.id)) is not None
    notification = db.scalar(select(Notification).where(Notification.tenant_id == tenant.id, Notification.user_id == user.id))
    assert notification is not None
    assert notification.title == "Welcome to Spark IoT"
    assert "Free workspace is ready" in notification.body


def test_usage_returns_free_plus_pro_enterprise_plan_metadata_and_legacy_starter_mapping():
    db = memory_session()
    tenants = [
        Tenant(id="tenant-free", name="Free Lab", plan_code="free"),
        Tenant(id="tenant-plus", name="Plus Lab", plan_code="plus"),
        Tenant(id="tenant-pro", name="Pro Lab", plan_code="pro"),
        Tenant(id="tenant-enterprise", name="Enterprise Lab", plan_code="enterprise"),
        Tenant(id="tenant-starter", name="Starter Legacy Lab", plan_code="starter"),
    ]
    db.add_all(tenants)
    db.commit()

    free_usage = usage(db, "tenant-free")
    plus_usage = usage(db, "tenant-plus")
    pro_usage = usage(db, "tenant-pro")
    enterprise_usage = usage(db, "tenant-enterprise")
    starter_usage = usage(db, "tenant-starter")

    assert free_usage["plan_code"] == "free"
    assert free_usage["plan_name"] == "Free"
    assert free_usage["monthly_price_rm"] == 0
    assert free_usage["max_projects"] == 1
    assert free_usage["max_devices"] == 1
    assert free_usage["retention_days"] == 7
    assert plus_usage["plan_code"] == "plus"
    assert plus_usage["plan_name"] == "Plus"
    assert plus_usage["monthly_price_rm"] == 25
    assert plus_usage["max_projects"] == 3
    assert plus_usage["max_devices"] == 3
    assert pro_usage["plan_code"] == "pro"
    assert pro_usage["monthly_price_rm"] == 49
    assert pro_usage["max_projects"] > plus_usage["max_projects"]
    assert enterprise_usage["plan_code"] == "enterprise"
    assert enterprise_usage["monthly_price_rm"] is None
    assert starter_usage["plan_code"] == "plus"
    assert starter_usage["plan_name"] == "Plus"


def test_register_rejects_duplicate_email_without_creating_extra_tenant():
    db = memory_session()
    payload = RegisterRequest(
        tenant_name="First Lab",
        full_name="First User",
        email="customer@example.com",
        password="SparkDemo123!",
    )
    register(payload, db)

    try:
        register(
            RegisterRequest(
                tenant_name="Duplicate Lab",
                full_name="Second User",
                email="CUSTOMER@example.com",
                password="SparkDemo123!",
            ),
            db,
        )
    except Exception as exc:
        assert getattr(exc, "status_code") == 409
        assert exc.detail["code"] == "duplicate_email"
    else:
        raise AssertionError("expected duplicate signup email to fail")

    assert db.query(Tenant).count() == 1
    assert db.query(User).count() == 1


def test_password_reset_request_creates_hashed_one_time_token_and_notification():
    db = memory_session()
    register(
        RegisterRequest(
            tenant_name="Reset Lab",
            full_name="Reset User",
            email="reset@example.com",
            password="SparkDemo123!",
        ),
        db,
    )

    response = request_password_reset(PasswordResetRequest(email="RESET@example.com"), db)

    user = db.scalar(select(User).where(User.email == "reset@example.com"))
    token_record = db.scalar(select(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
    assert response.status == "ok"
    assert response.reset_token is not None
    assert token_record is not None
    assert token_record.token_hash != response.reset_token
    assert token_record.used_at is None
    notification = db.scalar(select(Notification).where(Notification.user_id == user.id, Notification.title == "Password reset requested"))
    assert notification is not None
    assert "reset link" in notification.body


def test_password_reset_confirm_updates_password_revokes_sessions_and_prevents_reuse():
    db = memory_session()
    token_pair = register(
        RegisterRequest(
            tenant_name="Confirm Reset Lab",
            full_name="Confirm User",
            email="confirm-reset@example.com",
            password="SparkDemo123!",
        ),
        db,
    )
    reset = request_password_reset(PasswordResetRequest(email="confirm-reset@example.com"), db)

    response = confirm_password_reset(
        PasswordResetConfirmRequest(token=reset.reset_token, password="NewSpark123!"),
        db,
    )

    user = db.scalar(select(User).where(User.email == "confirm-reset@example.com"))
    assert response.status == "ok"
    assert verify_secret("NewSpark123!", user.password_hash)
    assert not verify_secret("SparkDemo123!", user.password_hash)
    assert db.scalar(select(RefreshToken).where(RefreshToken.token_hash != "", RefreshToken.revoked == False)) is None  # noqa: E712
    token_record = db.scalar(select(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
    assert token_record.used_at is not None
    assert token_pair.refresh_token

    try:
        confirm_password_reset(PasswordResetConfirmRequest(token=reset.reset_token, password="AnotherSpark123!"), db)
    except Exception as exc:
        assert getattr(exc, "status_code") == 400
        assert exc.detail["code"] == "invalid_reset_token"
    else:
        raise AssertionError("expected reset token reuse to fail")


def test_parse_topic_accepts_valid_telemetry_topic():
    assert parse_topic("spark/v1/tenant-1/device-1/telemetry/temperature") == {"version": "v1", "tenant_id": "tenant-1", "device_id": "device-1", "kind": "telemetry", "channel": "temperature"}


def test_command_topic_uses_command_namespace():
    assert command_topic("tenant-1", "device-1", "pump") == "spark/v1/tenant-1/device-1/command/pump"


def test_normalize_gps_rejects_invalid_latitude():
    try:
        normalize_value("gps", {"lat": 300, "lng": 101})
    except ValueError as exc:
        assert "out of range" in str(exc)
    else:
        raise AssertionError("expected invalid GPS coordinates to fail")


def test_mqtt_payload_builds_ingest_request_for_virtual_pin():
    topic = parse_topic("spark/v1/demo-tenant/device-irrigation/telemetry/V0")
    payload = b'{"token":"spk_dev_irrigation_demo_9f3a","value":29.4,"unit":"C","message_id":"m-1"}'

    request = build_ingest_request(topic, payload)

    assert request.device_id == "device-irrigation"
    assert request.channel == "V0"
    assert request.token == "spk_dev_irrigation_demo_9f3a"
    assert request.value == 29.4
    assert request.unit == "C"
    assert request.message_id == "m-1"


def test_mqtt_ack_payload_builds_command_log_fields():
    topic = parse_topic("spark/v1/demo-tenant/device-irrigation/ack/V3")
    payload = b'{"status":"ok","value":true,"message":"Pump command applied"}'

    log_payload = build_ack_log_payload(topic, payload)

    assert log_payload == {
        "tenant_id": "demo-tenant",
        "device_id": "device-irrigation",
        "channel": "V3",
        "status": "ack",
        "value": {"status": "ok", "value": True, "message": "Pump command applied"},
    }


def test_normalize_virtual_pin_gps_payload_by_shape():
    assert normalize_value("V5", {"lat": 3.139, "lng": 101.6869, "speed": 14}) == {"lat": 3.139, "lng": 101.6869, "speed": 14}


def test_normalize_virtual_pin_camera_payload_by_shape():
    assert normalize_value("V6", {"url": "https://example.com/cam.jpg"}) == {"url": "https://example.com/cam.jpg"}


def test_telemetry_event_payload_unwraps_raw_values():
    class Record:
        id = "telemetry-1"
        project_id = "project-irrigation"
        device_id = "device-irrigation"
        channel = "V0"
        value = {"raw": 30.2}
        unit = "C"
        observed_at = "2026-07-13T10:00:00Z"
        server_at = "2026-07-13T10:00:01Z"

    payload = telemetry_event_payload(Record())
    assert payload["value"] == 30.2
    assert payload["project_id"] == "project-irrigation"


def test_realtime_subscription_scope_requires_token_project_tenant_match():
    engine = make_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    db = Session()

    tenant = Tenant(id="tenant-realtime", name="Realtime Tenant")
    other_tenant = Tenant(id="tenant-realtime-other", name="Other Realtime Tenant")
    user = User(id="user-realtime", tenant_id=tenant.id, email="realtime@example.com", full_name="Realtime User", password_hash=hash_secret("SparkDemo123!"))
    project = Project(id="project-realtime", tenant_id=tenant.id, name="Realtime Project")
    other_project = Project(id="project-realtime-other", tenant_id=other_tenant.id, name="Other Realtime Project")
    db.add_all([tenant, other_tenant, user, project, other_project])
    db.commit()

    token = create_access_token(user.id, tenant.id)

    assert realtime_subscription_scope(token, project.id, db) == (tenant.id, project.id)

    try:
        realtime_subscription_scope(token, other_project.id, db)
    except ValueError as exc:
        assert "Project not found" in str(exc)
    else:
        raise AssertionError("expected cross-tenant realtime subscription to fail")


def test_telemetry_ingest_is_idempotent_by_device_channel_and_message_id():
    engine = make_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    db = Session()

    tenant = Tenant(id="tenant-idempotent", name="Idempotent Tenant")
    project = Project(id="project-idempotent", tenant_id=tenant.id, name="Idempotent Project")
    device = Device(id="device-idempotent", tenant_id=tenant.id, project_id=project.id, name="Idempotent Device", board="ESP32", secret_hash=hash_secret("device-token"))
    db.add_all([tenant, project, device])
    db.commit()

    first = ingest(db, tenant.id, TelemetryIngestRequest(device_id=device.id, token="device-token", channel="V0", value=29.4, unit="C", message_id="wifi-retry-1"))
    second = ingest(db, tenant.id, TelemetryIngestRequest(device_id=device.id, token="device-token", channel="V0", value=99.9, unit="C", message_id="wifi-retry-1"))
    other_channel = ingest(db, tenant.id, TelemetryIngestRequest(device_id=device.id, token="device-token", channel="V1", value=55, unit="%", message_id="wifi-retry-1"))

    rows = db.query(Telemetry).order_by(Telemetry.channel).all()

    assert second.id == first.id
    assert second.value == {"raw": 29.4}
    assert other_channel.id != first.id
    assert [(row.channel, row.message_id, row.value) for row in rows] == [
        ("V0", "wifi-retry-1", {"raw": 29.4}),
        ("V1", "wifi-retry-1", {"raw": 55}),
    ]


def test_telemetry_schema_has_database_retry_dedupe_guard():
    index = next((item for item in Telemetry.__table__.indexes if item.name == "uq_telemetry_message_retry"), None)

    assert index is not None
    assert index.unique is True
    assert [column.name for column in index.columns] == ["tenant_id", "device_id", "channel", "message_id"]
    assert str(index.dialect_options["postgresql"]["where"]) == "message_id IS NOT NULL"
    assert str(index.dialect_options["sqlite"]["where"]) == "message_id IS NOT NULL"


def test_runtime_index_upgrade_adds_retry_guard_to_existing_sqlite_database():
    engine = make_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE telemetry (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, device_id TEXT NOT NULL, channel TEXT NOT NULL, message_id TEXT NULL)"))

    ensure_runtime_indexes(engine)

    with engine.connect() as connection:
        indexes = connection.execute(text("PRAGMA index_list('telemetry')")).mappings().all()
        retry_index = next((index for index in indexes if index["name"] == "uq_telemetry_message_retry"), None)

    assert retry_index is not None
    assert retry_index["unique"] == 1
    assert retry_index["partial"] == 1


def test_mqtt_protocol_documents_message_id_idempotency():
    docs = (ROOT / "docs" / "mqtt-protocol.md").read_text(encoding="utf-8")

    assert "same tenant, device, channel, and `message_id`" in docs
    assert "without duplicating history rows or retriggering alert rules" in docs
    assert "reuse the same `message_id`" in docs
    assert "database-level unique retry guard" in docs


def test_mqtt_connect_accepts_paho_v2_success_reason_code_object():
    class ReasonCodeLike:
        is_failure = False

        def __str__(self) -> str:
            return "Success"

    assert is_successful_connect(ReasonCodeLike()) is True


def test_demo_board_payload_exposes_safe_connection_details_and_latest_values():
    class Device:
        id = "device-irrigation"
        name = "ESP32 Irrigation Node"
        board = "ESP32"
        is_online = True
        last_seen_at = None

    class Reading:
        device_id = "device-irrigation"
        channel = "V0"
        value = {"raw": 31.5}
        unit = "C"
        observed_at = "2026-07-14T08:50:07Z"
        server_at = "2026-07-14T08:50:08Z"

    payload = build_board_test_payload(
        tenant_id="demo-tenant",
        project_id="project-irrigation",
        public_host="34.73.29.12",
        mqtt_port=1883,
        devices=[Device()],
        latest=[Reading()],
    )

    assert payload["mqtt"]["host"] == "34.73.29.12"
    assert payload["mqtt"]["port"] == 1883
    assert payload["devices"][0]["telemetry_topic"] == "spark/v1/demo-tenant/device-irrigation/telemetry/{channel}"
    assert payload["latest"]["device-irrigation:V0"]["value"] == 31.5


def test_demo_command_response_uses_command_namespace_and_raw_value():
    response = build_demo_command_response(
        tenant_id="demo-tenant",
        device_id="device-irrigation",
        channel="V3",
        value=True,
        status="published",
    )

    assert response == {
        "status": "published",
        "topic": "spark/v1/demo-tenant/device-irrigation/command/V3",
        "payload": {"value": True},
    }


def valid_template_payload() -> dict:
    return {
        "revision": 1,
        "name": "Smart Irrigation",
        "board": "ESP32",
        "description": "Persistent template test",
        "datastreams": [
            {"id": "ds-temp", "name": "Temperature", "pin": "V0", "dataType": "float", "unit": "C", "min": 0, "max": 100, "color": "#2563eb"},
            {"id": "ds-pump", "name": "Pump", "pin": "V1", "dataType": "boolean", "unit": "", "min": 0, "max": 1, "color": "#7c3aed"},
        ],
        "notifications": [
            {"id": "rule-temp", "name": "Temperature Alert", "datastreamId": "ds-temp", "operator": ">", "threshold": 80, "channel": "push", "cooldownMinutes": 15}
        ],
        "dashboard": {
            "id": "dashboard-1",
            "project_id": "project-irrigation",
            "name": "Smart Irrigation Dashboard",
            "revision": 1,
            "widgets": [
                {"id": "w-temp", "type": "gauge", "title": "Temperature", "x": 0, "y": 0, "w": 4, "h": 3, "deviceId": "device-irrigation", "channel": "V0", "datastreamId": "ds-temp"}
            ],
        },
    }


def test_template_studio_update_accepts_professional_template_shape():
    payload = TemplateStudioUpdate(**valid_template_payload())

    assert payload.name == "Smart Irrigation"
    assert payload.datastreams[0].pin == "V0"
    assert payload.dashboard.widgets[0]["type"] == "gauge"


def test_template_studio_accepts_starter_professional_dashboard_size_and_widgets():
    payload = valid_template_payload()
    payload["datastreams"].extend(
        [
            {"id": "ds-schedule", "name": "Irrigation Schedule", "pin": "V2", "dataType": "time", "unit": "AUTO", "color": "#f59e0b"},
            {"id": "ds-power", "name": "Power Hub", "pin": "V3", "dataType": "float", "unit": "V", "min": 0, "max": 15, "color": "#2563eb"},
            {"id": "ds-event", "name": "Event Monitor", "pin": "V4", "dataType": "string", "unit": "", "color": "#e11d48"},
        ]
    )
    payload["dashboard"]["widgets"] = [
        {"id": f"w-{index}", "type": "value", "title": f"Value {index}", "x": index % 12, "y": index, "w": 3, "h": 2, "deviceId": "device-irrigation", "channel": "V0", "datastreamId": "ds-temp"}
        for index in range(15)
    ]
    payload["dashboard"]["widgets"][12]["type"] = "schedule"
    payload["dashboard"]["widgets"][12]["channel"] = "V2"
    payload["dashboard"]["widgets"][12]["datastreamId"] = "ds-schedule"
    payload["dashboard"]["widgets"][13]["type"] = "power_hub"
    payload["dashboard"]["widgets"][13]["channel"] = "V3"
    payload["dashboard"]["widgets"][13]["datastreamId"] = "ds-power"
    payload["dashboard"]["widgets"][14]["type"] = "event_monitor"
    payload["dashboard"]["widgets"][14]["channel"] = "V4"
    payload["dashboard"]["widgets"][14]["datastreamId"] = "ds-event"

    parsed = TemplateStudioUpdate(**payload)

    assert len(parsed.dashboard.widgets) == 15
    assert parsed.dashboard.widgets[12]["type"] == "schedule"
    assert parsed.dashboard.widgets[13]["type"] == "power_hub"
    assert parsed.dashboard.widgets[14]["type"] == "event_monitor"


def test_template_studio_accepts_time_and_configurable_schedule_widgets():
    payload = valid_template_payload()
    payload["datastreams"].extend(
        [
            {"id": "ds-time", "name": "Pump Time", "pin": "V2", "dataType": "time", "unit": "", "color": "#2563eb"},
            {"id": "ds-schedule", "name": "Irrigation Schedule", "pin": "V3", "dataType": "time", "unit": "AUTO", "color": "#2563eb"},
        ]
    )
    payload["dashboard"]["widgets"].extend(
        [
            {"id": "w-time", "type": "time", "title": "Pump Time", "x": 3, "y": 0, "w": 3, "h": 2, "deviceId": "device-irrigation", "channel": "V2", "datastreamId": "ds-time"},
            {"id": "w-schedule", "type": "schedule", "title": "Irrigation Schedule", "x": 6, "y": 0, "w": 3, "h": 3, "deviceId": "device-irrigation", "channel": "V3", "datastreamId": "ds-schedule", "days": ["mon", "wed", "fri"], "timeSlots": ["06:00", "12:00", "18:00"], "maxTimeSlots": 3},
        ]
    )

    parsed = TemplateStudioUpdate(**payload)

    assert parsed.dashboard.widgets[1]["type"] == "time"
    assert parsed.dashboard.widgets[2]["type"] == "schedule"
    assert parsed.dashboard.widgets[2]["timeSlots"] == ["06:00", "12:00", "18:00"]
    assert parsed.dashboard.widgets[2]["maxTimeSlots"] == 3


def test_template_studio_rejects_invalid_schedule_widget_shape():
    payload = valid_template_payload()
    payload["datastreams"].append({"id": "ds-schedule", "name": "Irrigation Schedule", "pin": "V2", "dataType": "time", "unit": "AUTO", "color": "#2563eb"})
    payload["dashboard"]["widgets"].append(
        {"id": "w-schedule", "type": "schedule", "title": "Irrigation Schedule", "x": 3, "y": 0, "w": 3, "h": 3, "deviceId": "device-irrigation", "channel": "V2", "datastreamId": "ds-schedule", "days": ["monday"], "timeSlots": ["25:00"], "maxTimeSlots": 1}
    )

    with pytest.raises(ValueError) as exc:
        TemplateStudioUpdate(**payload)

    assert "Schedule widget days must use mon/tue/wed/thu/fri/sat/sun" in str(exc.value)


def test_template_studio_rejects_duplicate_virtual_pins():
    payload = valid_template_payload()
    payload["datastreams"][1]["pin"] = "V0"

    try:
        TemplateStudioUpdate(**payload)
    except ValueError as exc:
        assert "Virtual pins must be unique" in str(exc)
    else:
        raise AssertionError("expected duplicate virtual pins to fail")


def test_template_studio_rejects_rule_for_unknown_datastream():
    payload = valid_template_payload()
    payload["notifications"][0]["datastreamId"] = "missing-ds"

    try:
        TemplateStudioUpdate(**payload)
    except ValueError as exc:
        assert "unknown datastream" in str(exc)
    else:
        raise AssertionError("expected invalid notification target to fail")


def test_template_studio_rejects_more_than_starter_widget_limit():
    payload = valid_template_payload()
    payload["dashboard"]["widgets"] = [
        {"id": f"w-{index}", "type": "value", "title": f"Value {index}", "x": 0, "y": index, "w": 3, "h": 2, "deviceId": "device-irrigation", "channel": "V0"}
        for index in range(19)
    ]

    try:
        TemplateStudioUpdate(**payload)
    except ValueError as exc:
        assert "Starter plan allows 18 widgets" in str(exc)
    else:
        raise AssertionError("expected starter widget limit to fail")


def template_route_db():
    engine = make_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    db = Session()
    tenant = Tenant(id="tenant-template", name="Template Tenant")
    other_tenant = Tenant(id="tenant-other", name="Other Tenant")
    user = User(id="user-template", tenant_id=tenant.id, email="template@example.com", full_name="Template User", password_hash=hash_secret("SparkDemo123!"))
    project = Project(id="project-template", tenant_id=tenant.id, name="Template Project", description="Real account template")
    dashboard = Dashboard(id="dashboard-template", tenant_id=tenant.id, project_id=project.id, name="Template Project Dashboard", widgets=[])
    other_project = Project(id="project-other", tenant_id=other_tenant.id, name="Other Project", description="Wrong tenant")
    other_dashboard = Dashboard(id="dashboard-other", tenant_id=other_tenant.id, project_id=other_project.id, name="Other Dashboard", widgets=[])
    db.add_all([tenant, other_tenant, user, project, dashboard, other_project, other_dashboard])
    db.commit()
    return db, user, project, dashboard


def account_template_payload(project_id: str, dashboard_id: str, revision: int = 1) -> dict:
    payload = valid_template_payload()
    payload["revision"] = revision
    payload["name"] = "Customer Irrigation"
    payload["dashboard"]["id"] = dashboard_id
    payload["dashboard"]["project_id"] = project_id
    payload["dashboard"]["revision"] = revision
    payload["dashboard"]["name"] = "Customer Irrigation Dashboard"
    return payload


def test_account_template_routes_create_list_and_update_persistent_template():
    db, user, project, dashboard = template_route_db()

    created = create_template(TemplateStudioUpdate(**account_template_payload(project.id, dashboard.id)), user=user, db=db)

    assert created["name"] == "Customer Irrigation"
    assert created["revision"] == 1
    assert created["dashboard"]["id"] == dashboard.id
    assert created["datastreams"][0]["pin"] == "V0"

    rows = list_templates(user=user, db=db)
    assert [row["id"] for row in rows] == [created["id"]]

    update_payload = account_template_payload(project.id, dashboard.id, revision=1)
    update_payload["name"] = "Customer Irrigation v2"
    update_payload["dashboard"]["widgets"][0]["title"] = "Temperature v2"
    updated = update_template(created["id"], TemplateStudioUpdate(**update_payload), user=user, db=db)

    assert updated["name"] == "Customer Irrigation v2"
    assert updated["revision"] == 2
    assert updated["dashboard"]["revision"] == 2
    assert db.get(DeviceTemplateRecord, created["id"]).datastreams[0]["pin"] == "V0"


def test_account_template_route_saves_new_schedule_widget_and_time_datastream():
    db, user, project, dashboard = template_route_db()
    created = create_template(TemplateStudioUpdate(**account_template_payload(project.id, dashboard.id)), user=user, db=db)
    payload = account_template_payload(project.id, dashboard.id, revision=1)
    payload["datastreams"].append({"id": "ds-schedule", "name": "Board Schedule", "pin": "V2", "dataType": "time", "unit": "", "color": "#2563eb"})
    payload["dashboard"]["widgets"].append({
        "id": "w-schedule",
        "type": "schedule",
        "title": "Board Schedule",
        "x": 3,
        "y": 0,
        "w": 3,
        "h": 3,
        "deviceId": "device-irrigation",
        "channel": "V2",
        "datastreamId": "ds-schedule",
        "unit": "",
        "days": ["mon", "wed", "fri"],
        "timeSlots": ["06:00", "12:00", "18:00"],
        "maxTimeSlots": 3,
    })

    updated = update_template(created["id"], TemplateStudioUpdate(**payload), user=user, db=db)

    assert updated["revision"] == 2
    assert updated["datastreams"][-1]["dataType"] == "time"
    assert updated["dashboard"]["widgets"][-1]["type"] == "schedule"
    assert updated["dashboard"]["widgets"][-1]["timeSlots"] == ["06:00", "12:00", "18:00"]


def test_account_template_routes_reject_duplicate_project_template_and_stale_revision():
    db, user, project, dashboard = template_route_db()
    created = create_template(TemplateStudioUpdate(**account_template_payload(project.id, dashboard.id)), user=user, db=db)

    try:
        create_template(TemplateStudioUpdate(**account_template_payload(project.id, dashboard.id)), user=user, db=db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 409
        assert exc.detail["code"] == "template_project_exists"
    else:
        raise AssertionError("expected one template per project enforcement")

    try:
        first_update = account_template_payload(project.id, dashboard.id, revision=1)
        update_template(created["id"], TemplateStudioUpdate(**first_update), user=user, db=db)
        stale_update = account_template_payload(project.id, dashboard.id, revision=1)
        stale_update["dashboard"]["revision"] = 2
        update_template(created["id"], TemplateStudioUpdate(**stale_update), user=user, db=db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 409
        assert exc.detail["code"] == "stale_template_revision"
    else:
        raise AssertionError("expected stale revision to fail")


def test_account_template_routes_reject_cross_tenant_dashboard_project():
    db, user, _project, _dashboard = template_route_db()

    try:
        create_template(TemplateStudioUpdate(**account_template_payload("project-other", "dashboard-other")), user=user, db=db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 404
    else:
        raise AssertionError("expected cross-tenant dashboard/project to fail")


def test_account_device_command_logs_are_tenant_scoped_and_include_ack_entries():
    engine = make_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    db = Session()
    tenant = Tenant(id="tenant-command", name="Command Tenant")
    other_tenant = Tenant(id="tenant-command-other", name="Other Command Tenant")
    user = User(id="user-command", tenant_id=tenant.id, email="command@example.com", full_name="Command User", password_hash=hash_secret("SparkDemo123!"))
    other_user = User(id="user-other-command", tenant_id=other_tenant.id, email="other-command@example.com", full_name="Other User", password_hash=hash_secret("SparkDemo123!"))
    project = Project(id="project-command", tenant_id=tenant.id, name="Command Project")
    device = Device(id="device-command", tenant_id=tenant.id, project_id=project.id, name="Command Device", board="ESP32", secret_hash=hash_secret("device-token"))
    db.add_all([tenant, other_tenant, user, other_user, project, device])
    db.flush()
    db.add_all([
        CommandLog(tenant_id=tenant.id, device_id=device.id, channel="V3", value={"raw": True}, status="published", created_at=datetime(2026, 7, 15, 8, 0, tzinfo=UTC)),
        CommandLog(tenant_id=tenant.id, device_id=device.id, channel="V3", value={"status": "ok", "value": True, "message": "Pump command applied"}, status="ack", created_at=datetime(2026, 7, 15, 8, 1, tzinfo=UTC)),
    ])
    db.commit()

    rows = command_logs(device.id, user=user, db=db)

    assert [row["status"] for row in rows] == ["ack", "published"]
    assert rows[0]["value"] == {"status": "ok", "value": True, "message": "Pump command applied"}
    assert rows[1]["value"] is True

    try:
        command_logs(device.id, user=other_user, db=db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 404
    else:
        raise AssertionError("expected cross-tenant command log access to fail")


def test_account_history_csv_export_is_tenant_scoped_and_json_safe():
    engine = make_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    db = Session()

    tenant = Tenant(id="tenant-history", name="History Tenant")
    other_tenant = Tenant(id="tenant-history-other", name="Other History Tenant")
    user = User(id="user-history", tenant_id=tenant.id, email="history@example.com", full_name="History User", password_hash=hash_secret("SparkDemo123!"))
    other_user = User(id="user-history-other", tenant_id=other_tenant.id, email="other-history@example.com", full_name="Other History User", password_hash=hash_secret("SparkDemo123!"))
    project = Project(id="project-history", tenant_id=tenant.id, name="History Project")
    device = Device(id="device-history", tenant_id=tenant.id, project_id=project.id, name="History Device", board="ESP32", secret_hash=hash_secret("device-token"))
    other_project = Project(id="project-history-other", tenant_id=other_tenant.id, name="Other History Project")
    other_device = Device(id="device-history-other", tenant_id=other_tenant.id, project_id=other_project.id, name="Other History Device", board="ESP8266", secret_hash=hash_secret("other-token"))
    db.add_all([tenant, other_tenant, user, other_user, project, device, other_project, other_device])
    db.flush()
    db.add_all([
        Telemetry(id="history-1", tenant_id=tenant.id, project_id=project.id, device_id=device.id, channel="V5", value={"raw": {"lat": 3.139, "lng": 101.6869, "speed": 14}}, unit=None, observed_at=datetime(2026, 7, 15, 8, 0, tzinfo=UTC), server_at=datetime(2026, 7, 15, 8, 0, 1, tzinfo=UTC)),
        Telemetry(id="history-2", tenant_id=tenant.id, project_id=project.id, device_id=device.id, channel="V0", value={"raw": 29.4}, unit="C", observed_at=datetime(2026, 7, 15, 8, 1, tzinfo=UTC), server_at=datetime(2026, 7, 15, 8, 1, 1, tzinfo=UTC)),
        Telemetry(id="history-other", tenant_id=other_tenant.id, project_id=other_project.id, device_id=other_device.id, channel="V5", value={"raw": {"lat": 1.0, "lng": 2.0}}, unit=None, observed_at=datetime(2026, 7, 15, 8, 2, tzinfo=UTC), server_at=datetime(2026, 7, 15, 8, 2, 1, tzinfo=UTC)),
    ])
    db.commit()

    response = history_csv(device.id, channel="V5", user=user, db=db)
    body = response.body.decode("utf-8")

    assert response.media_type == "text/csv; charset=utf-8"
    assert response.headers["content-disposition"] == 'attachment; filename="spark-iot-device-history-V5-history.csv"'
    assert "observed_at,server_at,device_id,channel,value,unit" in body
    assert "device-history,V5," in body
    assert '""lat"":3.139' in body
    assert "device-history-other" not in body
    assert "history-other" not in body

    try:
        history_csv(device.id, channel="V5", user=other_user, db=db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 404
    else:
        raise AssertionError("expected cross-tenant account CSV export to fail")


def test_threshold_alert_creates_notification_once_per_cooldown(monkeypatch):
    engine = make_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    db = Session()
    delivered = []

    def fake_deliver(_db, notification):
        delivered.append(notification.title)
        return 1

    monkeypatch.setattr("app.services.telemetry.deliver_notification_pushes", fake_deliver)

    tenant = Tenant(id="tenant-alert", name="Alert Tenant")
    user = User(id="user-alert", tenant_id=tenant.id, email="alert@example.com", full_name="Alert User", password_hash=hash_secret("SparkDemo123!"))
    project = Project(id="project-alert", tenant_id=tenant.id, name="Alert Project")
    device = Device(id="device-alert", tenant_id=tenant.id, project_id=project.id, name="Alert Device", board="ESP32", secret_hash=hash_secret("device-token"))
    rule = AlertRule(id="rule-alert", tenant_id=tenant.id, project_id=project.id, device_id=device.id, channel="V0", operator=">", threshold=80, cooldown_seconds=300)
    db.add_all([tenant, user, project, device, rule])
    db.commit()

    evaluate_alerts(db, tenant.id, device.id, "V0", 82)
    evaluate_alerts(db, tenant.id, device.id, "V0", 83)
    db.commit()

    notifications = db.query(Notification).all()
    assert len(notifications) == 1
    assert notifications[0].body == "V0 is 82 > 80"
    assert delivered == ["Alert triggered"]
    assert db.get(AlertRule, rule.id).last_triggered_at is not None


def test_notification_read_state_is_tenant_scoped():
    engine = make_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    db = Session()

    tenant = Tenant(id="tenant-notify", name="Notify Tenant")
    other_tenant = Tenant(id="tenant-notify-other", name="Other Notify Tenant")
    user = User(id="user-notify", tenant_id=tenant.id, email="notify@example.com", full_name="Notify User", password_hash=hash_secret("SparkDemo123!"))
    other_user = User(id="user-notify-other", tenant_id=other_tenant.id, email="other-notify@example.com", full_name="Other Notify User", password_hash=hash_secret("SparkDemo123!"))
    notification = Notification(id="notification-1", tenant_id=tenant.id, user_id=user.id, title="Pump Alert", body="Pump started", read=False)
    db.add_all([tenant, other_tenant, user, other_user, notification])
    db.commit()

    updated = mark_notification_read(notification.id, user=user, db=db)

    assert updated.id == notification.id
    assert updated.read is True
    assert db.get(Notification, notification.id).read is True

    try:
        mark_notification_read(notification.id, user=other_user, db=db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 404
    else:
        raise AssertionError("expected cross-tenant notification read update to fail")


def test_schedule_create_accepts_day_time_command_shape():
    payload = ScheduleCreate(
        project_id="project-irrigation",
        device_id="device-irrigation",
        channel="V3",
        value=True,
        time_of_day="06:30",
        recurrence="mon,wed,fri",
        timezone="Asia/Kuala_Lumpur",
    )

    assert payload.time_of_day == "06:30"
    assert payload.recurrence == "mon,wed,fri"


def test_schedule_create_rejects_invalid_time_or_day():
    for update in [{"time_of_day": "25:99"}, {"recurrence": "monday"}]:
        payload = {
            "project_id": "project-irrigation",
            "device_id": "device-irrigation",
            "channel": "V3",
            "value": True,
            "time_of_day": "06:30",
            "recurrence": "daily",
            **update,
        }
        try:
            ScheduleCreate(**payload)
        except ValueError:
            pass
        else:
            raise AssertionError("expected invalid schedule payload to fail")


def test_due_schedule_worker_publishes_once_per_occurrence(monkeypatch):
    engine = make_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    db = Session()
    published = []

    def fake_publish(tenant_id, device_id, channel, value):
        published.append((tenant_id, device_id, channel, value))

    monkeypatch.setattr("app.services.schedules.publish_command", fake_publish)

    tenant = Tenant(id="tenant-schedule", name="Schedule Tenant")
    project = Project(id="project-schedule", tenant_id=tenant.id, name="Schedule Project")
    device = Device(id="device-schedule", tenant_id=tenant.id, project_id=project.id, name="Schedule Device", board="ESP32", secret_hash=hash_secret("device-token"))
    schedule = Schedule(
        id="schedule-pump",
        tenant_id=tenant.id,
        project_id=project.id,
        device_id=device.id,
        channel="V3",
        command_value={"raw": True},
        time_of_day="06:30",
        recurrence="mon,wed,fri",
        timezone="Asia/Kuala_Lumpur",
    )
    db.add_all([tenant, project, device, schedule])
    db.commit()

    now = datetime(2026, 7, 14, 22, 30, tzinfo=UTC)  # Wednesday 06:30 in Asia/Kuala_Lumpur
    assert due_occurrence_key(schedule, now) == "sched:schedule:202607150630"

    assert run_due_schedules_once(db, now) == 1
    assert run_due_schedules_once(db, now) == 0

    logs = db.query(CommandLog).all()
    assert published == [(tenant.id, device.id, "V3", True)]
    assert len(logs) == 1
    assert logs[0].status == "sched:schedule:202607150630"
    assert logs[0].value == {"raw": True}


def test_delete_schedule_removes_only_tenant_schedule():
    db = memory_session()
    tenant = Tenant(id="tenant-delete-schedule", name="Delete Schedule Tenant")
    other_tenant = Tenant(id="tenant-delete-schedule-other", name="Other Delete Schedule Tenant")
    user = User(id="user-delete-schedule", tenant_id=tenant.id, email="schedule-delete@example.com", full_name="Schedule Delete", password_hash=hash_secret("SparkDemo123!"))
    schedule = Schedule(
        id="schedule-delete-me",
        tenant_id=tenant.id,
        project_id="project-delete-schedule",
        device_id="device-delete-schedule",
        channel="V3",
        command_value={"raw": True},
        timezone="Asia/Kuala_Lumpur",
        time_of_day="06:00",
        recurrence="daily",
    )
    other_schedule = Schedule(
        id="schedule-keep-other",
        tenant_id=other_tenant.id,
        project_id="project-other-schedule",
        device_id="device-other-schedule",
        channel="V4",
        command_value={"raw": False},
        timezone="Asia/Kuala_Lumpur",
        time_of_day="07:00",
        recurrence="daily",
    )
    db.add_all([tenant, other_tenant, user, schedule, other_schedule])
    db.commit()

    response = delete_schedule(schedule.id, user, db)

    assert response.message == "Schedule deleted"
    assert db.get(Schedule, schedule.id) is None
    assert db.get(Schedule, other_schedule.id) is not None

    with pytest.raises(Exception):
        delete_schedule(other_schedule.id, user, db)


def test_demo_history_payload_and_csv_unwrap_values_for_export():
    class Reading:
        id = "telemetry-1"
        device_id = "device-irrigation"
        channel = "V7"
        value = {"raw": {"lat": 3.139, "lng": 101.6869, "speed": 14}}
        unit = None
        observed_at = "2026-07-15T03:10:00Z"
        server_at = "2026-07-15T03:10:01Z"

    row = history_row_payload(Reading())
    csv_body = build_history_csv([Reading()])

    assert row["value"] == {"lat": 3.139, "lng": 101.6869, "speed": 14}
    assert "observed_at,server_at,device_id,channel,value,unit" in csv_body
    assert "device-irrigation,V7" in csv_body
    assert '"{""lat"":3.139,""lng"":101.6869,""speed"":14}"' in csv_body
