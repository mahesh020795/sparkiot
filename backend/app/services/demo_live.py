from typing import Any, Iterable

from app.services.mqtt import command_topic, telemetry_topic


DEMO_TENANT_ID = "demo-tenant"


def unwrap_telemetry_value(value: Any) -> Any:
    if isinstance(value, dict):
        return value.get("raw", value)
    return value


def reading_key(reading: Any) -> str:
    return f"{reading.device_id}:{reading.channel}"


def build_latest_map(latest: Iterable[Any]) -> dict[str, dict[str, Any]]:
    return {
        reading_key(reading): {
            "id": getattr(reading, "id", reading_key(reading)),
            "device_id": reading.device_id,
            "channel": reading.channel,
            "value": unwrap_telemetry_value(reading.value),
            "unit": reading.unit,
            "observed_at": reading.observed_at,
            "server_at": reading.server_at,
        }
        for reading in latest
    }


def build_board_test_payload(
    *,
    tenant_id: str,
    project_id: str,
    public_host: str,
    mqtt_port: int,
    devices: Iterable[Any],
    latest: Iterable[Any],
) -> dict[str, Any]:
    return {
        "tenant_id": tenant_id,
        "project_id": project_id,
        "mqtt": {
            "host": public_host,
            "port": mqtt_port,
            "protocol": "mqtt",
        },
        "devices": [
            {
                "id": device.id,
                "name": device.name,
                "board": device.board,
                "is_online": device.is_online,
                "last_seen_at": device.last_seen_at,
                "telemetry_topic": telemetry_topic(tenant_id, device.id, "{channel}"),
                "command_topic": command_topic(tenant_id, device.id, "{channel}"),
            }
            for device in devices
        ],
        "latest": build_latest_map(latest),
    }


def build_demo_command_response(
    *,
    tenant_id: str,
    device_id: str,
    channel: str,
    value: Any,
    status: str,
) -> dict[str, Any]:
    return {
        "status": status,
        "topic": command_topic(tenant_id, device_id, channel),
        "payload": {"value": value},
    }
