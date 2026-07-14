from app.services.mqtt import command_topic, parse_topic, telemetry_topic
from app.services.mqtt_bridge import build_ack_log_payload, build_ingest_request, is_successful_connect, telemetry_event_payload
from app.services.telemetry import normalize_value
from app.services.demo_live import build_board_test_payload, build_demo_command_response
from app.schemas.api import TemplateStudioUpdate


def test_topic_helpers_create_spark_namespace():
    assert telemetry_topic("tenant-1", "device-1", "temperature") == "spark/v1/tenant-1/device-1/telemetry/temperature"


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
        device_id = "device-irrigation"
        channel = "V0"
        value = {"raw": 30.2}
        unit = "C"
        observed_at = "2026-07-13T10:00:00Z"
        server_at = "2026-07-13T10:00:01Z"

    assert telemetry_event_payload(Record())["value"] == 30.2


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


def test_template_studio_rejects_more_than_ten_widgets():
    payload = valid_template_payload()
    payload["dashboard"]["widgets"] = [
        {"id": f"w-{index}", "type": "value", "title": f"Value {index}", "x": 0, "y": index, "w": 3, "h": 2, "deviceId": "device-irrigation", "channel": "V0"}
        for index in range(11)
    ]

    try:
        TemplateStudioUpdate(**payload)
    except ValueError as exc:
        assert "Starter plan allows 10 widgets" in str(exc)
    else:
        raise AssertionError("expected starter widget limit to fail")
