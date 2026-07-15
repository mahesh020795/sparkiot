import csv
import io
import json
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

def history_row_payload(record: Any) -> dict[str, Any]:
    return {
        "id": getattr(record, "id", reading_key(record)),
        "device_id": record.device_id,
        "channel": record.channel,
        "value": unwrap_telemetry_value(record.value),
        "unit": record.unit,
        "observed_at": record.observed_at,
        "server_at": record.server_at,
    }


def build_history_csv(records: Iterable[Any]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["observed_at", "server_at", "device_id", "channel", "value", "unit"])
    for record in records:
        row = history_row_payload(record)
        value = row["value"]
        if isinstance(value, (dict, list)):
            value = json.dumps(value, separators=(",", ":"), sort_keys=True)
        writer.writerow([row["observed_at"], row["server_at"], row["device_id"], row["channel"], value, row["unit"] or ""])
    return output.getvalue()
