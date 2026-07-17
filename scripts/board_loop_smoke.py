#!/usr/bin/env python3
"""Spark IoT board loop smoke test.

This script proves the practical hardware path used during ESP32/NodeMCU
testing:

telemetry -> command -> ACK -> command log

It uses the public demo API plus Mosquitto publishing. By default it assumes
you run it from the repository root on the Docker Compose host. For the Google
Cloud test VPS, pass the Nginx-proxied API base:

python scripts/board_loop_smoke.py --api-base http://iot.rectronx.com/api/v1
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SmokeConfig:
    api_base: str
    tenant_id: str
    device_id: str
    token: str
    telemetry_channel: str
    command_channel: str
    mqtt_host: str
    mqtt_port: int
    compose_service: str
    use_docker_compose: bool
    timeout_seconds: int


DEMO_COMMAND_PATH = "/demo/devices/{device_id}/commands"
DEMO_COMMAND_LOGS_PATH = "/demo/devices/{device_id}/command-logs"
DEFAULT_TELEMETRY_PATH = "telemetry/V0"
DEFAULT_ACK_PATH = "ack/V3"


def parse_args(argv: list[str]) -> SmokeConfig:
    parser = argparse.ArgumentParser(description="Spark IoT board loop smoke test")
    parser.add_argument("--api-base", default="http://localhost:8000/api/v1")
    parser.add_argument("--tenant-id", default="demo-tenant")
    parser.add_argument("--device-id", default="device-irrigation")
    parser.add_argument("--token", default="spk_dev_irrigation_demo_9f3a")
    parser.add_argument("--telemetry-channel", default="V0")
    parser.add_argument("--command-channel", default="V3")
    parser.add_argument("--mqtt-host", default="localhost")
    parser.add_argument("--mqtt-port", type=int, default=1883)
    parser.add_argument("--compose-service", default="mosquitto")
    parser.add_argument("--no-docker-compose", action="store_true", help="Use local mosquitto_pub instead of docker compose exec mosquitto")
    parser.add_argument("--timeout-seconds", type=int, default=20)
    args = parser.parse_args(argv)

    return SmokeConfig(
        api_base=args.api_base.rstrip("/"),
        tenant_id=args.tenant_id,
        device_id=args.device_id,
        token=args.token,
        telemetry_channel=args.telemetry_channel,
        command_channel=args.command_channel,
        mqtt_host=args.mqtt_host,
        mqtt_port=args.mqtt_port,
        compose_service=args.compose_service,
        use_docker_compose=not args.no_docker_compose,
        timeout_seconds=args.timeout_seconds,
    )


def request_json(method: str, url: str, payload: dict[str, Any] | None = None) -> Any:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=12) as response:
        data = response.read().decode("utf-8")
        return json.loads(data) if data else None


def publish_mqtt(config: SmokeConfig, topic: str, payload: dict[str, Any]) -> None:
    message = json.dumps(payload, separators=(",", ":"))
    if config.use_docker_compose:
        command = [
            "docker",
            "compose",
            "exec",
            "-T",
            config.compose_service,
            "mosquitto_pub",
            "-h",
            config.mqtt_host,
            "-p",
            str(config.mqtt_port),
            "-t",
            topic,
            "-m",
            message,
        ]
    else:
        command = [
            "mosquitto_pub",
            "-h",
            config.mqtt_host,
            "-p",
            str(config.mqtt_port),
            "-t",
            topic,
            "-m",
            message,
        ]

    subprocess.run(command, check=True)


def command_url(config: SmokeConfig) -> str:
    return f"{config.api_base}{DEMO_COMMAND_PATH.format(device_id=config.device_id)}"


def command_logs_url(config: SmokeConfig) -> str:
    return f"{config.api_base}{DEMO_COMMAND_LOGS_PATH.format(device_id=config.device_id)}"


def telemetry_topic(config: SmokeConfig) -> str:
    return f"spark/v1/{config.tenant_id}/{config.device_id}/telemetry/{config.telemetry_channel}"


def ack_topic(config: SmokeConfig) -> str:
    return f"spark/v1/{config.tenant_id}/{config.device_id}/ack/{config.command_channel}"


def wait_for_ack(config: SmokeConfig) -> list[dict[str, Any]]:
    deadline = time.time() + config.timeout_seconds
    while time.time() < deadline:
        logs = request_json("GET", command_logs_url(config))
        if any(log.get("status") == "ack" and log.get("channel") == config.command_channel for log in logs):
            return logs
        time.sleep(1)
    raise TimeoutError(f"No ACK log for {config.device_id}:{config.command_channel} after {config.timeout_seconds}s")


def run_smoke(config: SmokeConfig) -> None:
    print("Spark IoT board loop smoke")
    print(f"API: {config.api_base}")

    ready = request_json("GET", f"{config.api_base.replace('/api/v1', '')}/health/ready")
    print(f"health: {ready}")

    print(f"publish telemetry/V0 -> {telemetry_topic(config)}")
    publish_mqtt(
        config,
        telemetry_topic(config),
        {"token": config.token, "value": 31.8, "unit": "C", "message_id": f"smoke-{int(time.time())}"},
    )

    print(f"POST /demo/devices/{{device_id}}/commands -> {command_url(config)}")
    command_response = request_json("POST", command_url(config), {"channel": config.command_channel, "value": True})
    print(f"command: {command_response}")

    print(f"simulate board ACK -> {ack_topic(config)}")
    publish_mqtt(
        config,
        ack_topic(config),
        {"status": "ok", "value": True, "message": "Smoke ACK"},
    )

    print(f"GET /demo/devices/{{device_id}}/command-logs -> {command_logs_url(config)}")
    logs = wait_for_ack(config)
    print(f"latest command logs: {json.dumps(logs[:3], indent=2)}")
    print("PASS telemetry -> command -> ACK -> command log")


def main(argv: list[str] | None = None) -> int:
    config = parse_args(argv or sys.argv[1:])
    try:
        run_smoke(config)
    except (urllib.error.URLError, subprocess.CalledProcessError, TimeoutError, OSError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
