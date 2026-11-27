"""Tenant-scoped MCP JSON-RPC tools for Hesh IoT AI clients."""
from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.database import get_db
from app.models.domain import Dashboard, Device, Project, User
from app.services.mqtt import command_topic, publish_command

router = APIRouter(prefix="/mcp", tags=["mcp"])

TOOLS = [
    {"name": "list_projects", "description": "List active Hesh IoT projects.", "inputSchema": {"type": "object", "properties": {}}},
    {"name": "list_devices", "description": "List devices and online status.", "inputSchema": {"type": "object", "properties": {"project_id": {"type": "string"}}}},
    {"name": "get_dashboard", "description": "Read a project's dashboard layout.", "inputSchema": {"type": "object", "required": ["project_id"], "properties": {"project_id": {"type": "string"}}}},
    {"name": "create_dashboard", "description": "Create or replace a dashboard widget layout.", "inputSchema": {"type": "object", "required": ["project_id", "widgets"], "properties": {"project_id": {"type": "string"}, "name": {"type": "string"}, "widgets": {"type": "array", "items": {"type": "object"}}}}},
    {"name": "send_device_command", "description": "Publish a command to a device channel.", "inputSchema": {"type": "object", "required": ["device_id", "channel", "value"], "properties": {"device_id": {"type": "string"}, "channel": {"type": "string"}, "value": {}}}},
    {"name": "generate_firmware", "description": "Generate a starter SparkIoT Arduino sketch.", "inputSchema": {"type": "object", "required": ["board", "tenant_id", "device_id", "device_token"], "properties": {"board": {"type": "string", "enum": ["ESP32", "ESP8266"]}, "tenant_id": {"type": "string"}, "device_id": {"type": "string"}, "device_token": {"type": "string"}, "channels": {"type": "array", "items": {"type": "string"}}}}},
]

def _text(value: Any) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": json.dumps(value, default=str)}], "structuredContent": value}

def _project(db: Session, user: User, project_id: str) -> Project:
    project = db.scalar(select(Project).where(Project.id == project_id, Project.tenant_id == user.tenant_id, Project.is_active))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("")
def rpc(payload: dict[str, Any], user: User = Depends(current_user), db: Session = Depends(get_db)):
    method, request_id = payload.get("method"), payload.get("id")
    params = payload.get("params") or {}
    if method == "initialize":
        result = {"protocolVersion": "2025-03-26", "capabilities": {"tools": {}}, "serverInfo": {"name": "hesh-iot", "version": "0.1.0"}}
    elif method == "notifications/initialized":
        result = {}
    elif method == "tools/list":
        result = {"tools": TOOLS}
    elif method == "tools/call":
        try:
            result = {"content": [{"type": "text", "text": json.dumps(_call(params.get("name"), params.get("arguments") or {}, user, db), default=str)}]}
        except HTTPException as exc:
            return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32004, "message": str(exc.detail)}}
    else:
        return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32601, "message": "Method not found"}}
    return {"jsonrpc": "2.0", "id": request_id, "result": result}

def _call(name: str, args: dict[str, Any], user: User, db: Session) -> Any:
    if name == "list_projects":
        return [{"id": p.id, "name": p.name, "description": p.description} for p in db.scalars(select(Project).where(Project.tenant_id == user.tenant_id, Project.is_active)).all()]
    if name == "list_devices":
        query = select(Device).where(Device.tenant_id == user.tenant_id, Device.is_active)
        if args.get("project_id"): query = query.where(Device.project_id == args["project_id"])
        return [{"id": d.id, "project_id": d.project_id, "name": d.name, "board": d.board, "is_online": d.is_online, "last_seen_at": d.last_seen_at} for d in db.scalars(query).all()]
    if name == "get_dashboard":
        _project(db, user, args["project_id"])
        dashboard = db.scalar(select(Dashboard).where(Dashboard.project_id == args["project_id"], Dashboard.tenant_id == user.tenant_id))
        if not dashboard: raise HTTPException(status_code=404, detail="Dashboard not found")
        return {"id": dashboard.id, "project_id": dashboard.project_id, "name": dashboard.name, "revision": dashboard.revision, "widgets": dashboard.widgets}
    if name == "create_dashboard":
        project = _project(db, user, args["project_id"])
        dashboard = db.scalar(select(Dashboard).where(Dashboard.project_id == project.id, Dashboard.tenant_id == user.tenant_id))
        if not dashboard: dashboard = Dashboard(tenant_id=user.tenant_id, project_id=project.id, name=args.get("name") or f"{project.name} Dashboard", widgets=[]); db.add(dashboard)
        dashboard.name, dashboard.widgets = args.get("name") or dashboard.name, args["widgets"]
        dashboard.revision += 1; dashboard.updated_at = datetime.now(UTC); db.commit(); db.refresh(dashboard)
        return {"id": dashboard.id, "project_id": dashboard.project_id, "revision": dashboard.revision, "widgets": dashboard.widgets}
    if name == "send_device_command":
        device = db.scalar(select(Device).where(Device.id == args["device_id"], Device.tenant_id == user.tenant_id, Device.is_active))
        if not device: raise HTTPException(status_code=404, detail="Device not found")
        publish_command(user.tenant_id, device.id, args["channel"], args["value"])
        return {"status": "published", "device_id": device.id, "channel": args["channel"], "topic": command_topic(user.tenant_id, device.id, args["channel"])}
    if name == "generate_firmware":
        board, channels = args["board"], args.get("channels") or ["V0"]
        include = "#include <WiFi.h>" if board == "ESP32" else "#include <ESP8266WiFi.h>"
        code = f'''{include}\n#include <SparkIoT.h>\n\nconst char* WIFI_SSID = "YOUR_WIFI";\nconst char* WIFI_PASSWORD = "YOUR_PASSWORD";\nconst char* BROKER_HOST = "mqtt.rectronx.com";\nconst int BROKER_PORT = 1883;\nconst char* TENANT_ID = "{args["tenant_id"]}";\nconst char* DEVICE_ID = "{args["device_id"]}";\nconst char* DEVICE_TOKEN = "{args["device_token"]}";\n\nvoid setup() {{ Serial.begin(115200); SparkIoT.begin(WIFI_SSID, WIFI_PASSWORD, BROKER_HOST, BROKER_PORT, TENANT_ID, DEVICE_ID, DEVICE_TOKEN); SparkIoT.publishStatus("online"); }}\nvoid loop() {{ SparkIoT.virtualWrite("{channels[0]}", analogRead(A0), "raw"); delay(5000); }}\n'''
        return {"board": board, "filename": f"HeshIoT_{board}.ino", "code": code}
    raise HTTPException(status_code=400, detail=f"Unknown tool: {name}")
