from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import paho.mqtt.client as mqtt

from app.core.config import Settings, get_settings
from app.core.database import SessionLocal
from app.models.domain import CommandLog, Device
from app.schemas.api import TelemetryIngestRequest
from app.services.mqtt import parse_topic
from app.services.realtime import hub
from app.services.telemetry import ingest

logger = logging.getLogger(__name__)


MQTT_SUBSCRIPTIONS = ("spark/v1/+/+/telemetry/+", "spark/v1/+/+/ack/+")


def is_successful_connect(reason_code: Any) -> bool:
    """Return True when Paho MQTT reports a successful CONNACK.

    Paho v2 passes a ReasonCode object here, not always an integer. The object
    exposes `is_failure`, while older callback styles may still provide 0.
    """
    if hasattr(reason_code, "is_failure"):
        return not bool(reason_code.is_failure)
    return reason_code == 0 or str(reason_code) in {"0", "Success"}


def build_ingest_request(topic_parts: dict[str, str], payload: bytes) -> TelemetryIngestRequest:
    if topic_parts.get("kind") != "telemetry":
        raise ValueError("Only telemetry topics can be ingested")
    try:
        body = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("MQTT telemetry payload must be valid JSON") from exc
    if not isinstance(body, dict):
        raise ValueError("MQTT telemetry payload must be a JSON object")
    if "token" not in body:
        raise ValueError("MQTT telemetry payload requires token")
    if "value" not in body:
        raise ValueError("MQTT telemetry payload requires value")
    return TelemetryIngestRequest(
        device_id=topic_parts["device_id"],
        token=str(body["token"]),
        channel=topic_parts["channel"],
        value=body["value"],
        unit=body.get("unit"),
        ts=body.get("ts"),
        quality=body.get("quality") or {},
        message_id=body.get("message_id"),
    )


def build_ack_log_payload(topic_parts: dict[str, str], payload: bytes) -> dict[str, Any]:
    if topic_parts.get("kind") != "ack":
        raise ValueError("Only ack topics can be recorded as command logs")
    try:
        body = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("MQTT ack payload must be valid JSON") from exc
    if not isinstance(body, dict):
        body = {"value": body}
    return {
        "tenant_id": topic_parts["tenant_id"],
        "device_id": topic_parts["device_id"],
        "channel": topic_parts["channel"],
        "status": "ack",
        "value": body,
    }


def telemetry_event_payload(record: Any) -> dict[str, Any]:
    value = record.value.get("raw", record.value) if isinstance(record.value, dict) else record.value
    return {
        "id": record.id,
        "project_id": record.project_id,
        "device_id": record.device_id,
        "channel": record.channel,
        "value": value,
        "unit": record.unit,
        "observed_at": record.observed_at,
        "server_at": record.server_at,
    }


class MqttIngestionBridge:
    def __init__(self, loop: asyncio.AbstractEventLoop, settings: Settings | None = None) -> None:
        self.loop = loop
        self.settings = settings or get_settings()
        self.client: mqtt.Client | None = None

    def start(self) -> None:
        if self.client:
            return
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="spark-iot-api-ingestion")
        if self.settings.mqtt_username:
            client.username_pw_set(self.settings.mqtt_username, self.settings.mqtt_password)
        client.on_connect = self._on_connect
        client.on_message = self._on_message
        try:
            client.connect(self.settings.mqtt_host, self.settings.mqtt_port, keepalive=30)
        except OSError as exc:
            logger.warning("MQTT bridge could not connect to %s:%s: %s", self.settings.mqtt_host, self.settings.mqtt_port, exc)
            return
        client.loop_start()
        self.client = client
        logger.info("MQTT ingestion bridge started on %s:%s", self.settings.mqtt_host, self.settings.mqtt_port)

    def stop(self) -> None:
        if not self.client:
            return
        self.client.loop_stop()
        self.client.disconnect()
        self.client = None

    def _on_connect(self, client: mqtt.Client, _userdata: Any, _flags: Any, reason_code: Any, _properties: Any) -> None:
        if is_successful_connect(reason_code):
            for topic in MQTT_SUBSCRIPTIONS:
                client.subscribe(topic, qos=1)
            logger.info("MQTT bridge subscribed to %s", ", ".join(MQTT_SUBSCRIPTIONS))
        else:
            logger.warning("MQTT bridge connection rejected: %s", reason_code)

    def _on_message(self, _client: mqtt.Client, _userdata: Any, message: mqtt.MQTTMessage) -> None:
        try:
            topic_parts = parse_topic(message.topic)
            if topic_parts["kind"] == "telemetry":
                event = self._record_telemetry(topic_parts, message.payload)
                event_type = "telemetry"
            elif topic_parts["kind"] == "ack":
                event = self._record_ack(topic_parts, message.payload)
                event_type = "command_ack"
            else:
                return
            future = asyncio.run_coroutine_threadsafe(hub.publish(topic_parts["tenant_id"], {"type": event_type, "payload": event}, event.get("project_id")), self.loop)
            future.add_done_callback(self._log_publish_error)
        except Exception as exc:  # noqa: BLE001 - broker callbacks must never crash the MQTT loop
            logger.warning("MQTT message rejected from %s: %s", message.topic, exc)

    @staticmethod
    def _record_telemetry(topic_parts: dict[str, str], payload: bytes) -> dict[str, Any]:
        request = build_ingest_request(topic_parts, payload)
        with SessionLocal() as db:
            record = ingest(db, topic_parts["tenant_id"], request)
            return telemetry_event_payload(record)

    @staticmethod
    def _record_ack(topic_parts: dict[str, str], payload: bytes) -> dict[str, Any]:
        log_payload = build_ack_log_payload(topic_parts, payload)
        with SessionLocal() as db:
            device = db.get(Device, log_payload["device_id"])
            if not device or device.tenant_id != log_payload["tenant_id"] or not device.is_active:
                raise ValueError("ACK device is not active in this tenant")
            record = CommandLog(**log_payload)
            db.add(record)
            db.commit()
            db.refresh(record)
            return {
                "id": record.id,
                "tenant_id": record.tenant_id,
                "device_id": record.device_id,
                "channel": record.channel,
                "value": record.value,
                "status": record.status,
                "created_at": record.created_at,
            }

    @staticmethod
    def _log_publish_error(future: asyncio.Future) -> None:
        try:
            future.result()
        except Exception as exc:  # noqa: BLE001
            logger.warning("MQTT realtime broadcast failed: %s", exc)
