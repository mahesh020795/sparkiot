import json
from typing import Any

import paho.mqtt.client as mqtt

from app.core.config import get_settings


def telemetry_topic(tenant_id: str, device_id: str, channel: str) -> str:
    return f"spark/v1/{tenant_id}/{device_id}/telemetry/{channel}"


def command_topic(tenant_id: str, device_id: str, channel: str) -> str:
    return f"spark/v1/{tenant_id}/{device_id}/command/{channel}"


def parse_topic(topic: str) -> dict[str, str]:
    parts = topic.split("/")
    if len(parts) != 6 or parts[0] != "spark" or parts[1] != "v1":
        raise ValueError("Invalid Spark IoT topic")
    _, version, tenant_id, device_id, kind, channel = parts
    if kind not in {"telemetry", "command", "ack", "status"}:
        raise ValueError("Invalid Spark IoT topic kind")
    return {"version": version, "tenant_id": tenant_id, "device_id": device_id, "kind": kind, "channel": channel}


def publish_command(tenant_id: str, device_id: str, channel: str, value: Any) -> None:
    settings = get_settings()
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    if settings.mqtt_username:
        client.username_pw_set(settings.mqtt_username, settings.mqtt_password)
    client.connect(settings.mqtt_host, settings.mqtt_port, keepalive=20)
    client.publish(command_topic(tenant_id, device_id, channel), json.dumps({"value": value}), qos=1)
    client.disconnect()
