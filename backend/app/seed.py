from sqlalchemy import select

from app.core.database import SessionLocal, init_db
from app.core.security import hash_secret
from app.models.domain import AlertRule, Dashboard, Device, DeviceTemplateRecord, Notification, Project, Telemetry, Tenant, User

DEMO_EMAIL = "demo@sparkiot.dev"
DEMO_PASSWORD = "SparkDemo123!"
DEMO_TENANT_ID = "demo-tenant"
DEMO_PROJECTS = [
    ("project-irrigation", "Smart Irrigation", "GPS, camera and pump controls"),
    ("project-home", "Smart Home", "Switches, LED and meters"),
    ("project-energy", "Energy Monitor", "Meters and history charts"),
]
DEMO_DEVICES = [
    ("device-irrigation", "project-irrigation", "ESP32 Irrigation Node", "ESP32", "spk_dev_irrigation_demo_9f3a", True),
    ("device-home", "project-home", "ESP8266 Home Node", "ESP8266", "spk_dev_home_demo_2c8b", True),
    ("device-energy", "project-energy", "ESP32 Energy Node", "ESP32", "spk_dev_energy_demo_4d1e", False),
]


def stream(id: str, name: str, pin: str, data_type: str, unit: str = "", min_value: float | None = None, max_value: float | None = None, color: str = "#2563eb") -> dict:
    payload = {"id": id, "name": name, "pin": pin, "dataType": data_type, "unit": unit, "color": color}
    if min_value is not None:
        payload["min"] = min_value
    if max_value is not None:
        payload["max"] = max_value
    return payload


DEMO_TEMPLATE_STREAMS = {
    "project-irrigation": [
        stream("ds-temp", "Temperature", "V0", "float", "C", 0, 100, "#2563eb"),
        stream("ds-humidity", "Humidity", "V1", "integer", "%", 0, 100, "#2563eb"),
        stream("ds-soil", "Soil Moisture", "V2", "integer", "%", 0, 100, "#16a34a"),
        stream("ds-pump", "Pump Control", "V3", "boolean", "", 0, 1, "#7c3aed"),
        stream("ds-led", "Pump LED", "V4", "boolean", "", 0, 1, "#12b76a"),
        stream("ds-gps", "GPS Location", "V5", "gps", "", None, None, "#0891b2"),
        stream("ds-camera", "ESP32-CAM Snapshot", "V6", "image", "", None, None, "#475569"),
        stream("ds-serial", "Serial LCD", "V7", "string", "", None, None, "#334155"),
    ],
    "project-home": [
        stream("ds-relay", "Relay Switch", "V0", "boolean", "", 0, 1, "#2563eb"),
        stream("ds-light", "Room Light", "V1", "integer", "%", 0, 100, "#eab308"),
        stream("ds-door", "Door Status", "V2", "string", "", None, None, "#2563eb"),
    ],
    "project-energy": [
        stream("ds-voltage", "Voltage", "V0", "float", "V", 0, 260, "#2563eb"),
        stream("ds-current", "Current", "V1", "float", "A", 0, 30, "#2563eb"),
        stream("ds-power", "Power", "V2", "float", "W", 0, 5000, "#7c3aed"),
    ],
}


def hydrate_template_widgets(project_id: str, device_id: str) -> list[dict]:
    layouts = {
        "project-irrigation": [
            ("w-temp", "gauge", "ds-temp", 0, 0, 4, 3),
            ("w-humidity", "meter", "ds-humidity", 4, 0, 4, 3),
            ("w-soil", "value", "ds-soil", 8, 0, 4, 3),
            ("w-chart", "chart", "ds-temp", 0, 3, 6, 3),
            ("w-gps", "gps", "ds-gps", 6, 3, 3, 3),
            ("w-camera", "camera", "ds-camera", 9, 3, 3, 3),
            ("w-pump", "switch", "ds-pump", 0, 6, 3, 2),
            ("w-led", "led", "ds-led", 3, 6, 3, 2),
            ("w-serial", "serial_lcd", "ds-serial", 6, 6, 6, 2),
        ],
        "project-home": [
            ("w-relay", "switch", "ds-relay", 0, 0, 3, 2),
            ("w-light", "gauge", "ds-light", 3, 0, 3, 3),
            ("w-door", "value", "ds-door", 6, 0, 3, 2),
        ],
        "project-energy": [
            ("w-voltage", "meter", "ds-voltage", 0, 0, 3, 3),
            ("w-current", "gauge", "ds-current", 3, 0, 3, 3),
            ("w-power", "chart", "ds-power", 0, 3, 6, 3),
        ],
    }
    streams = {item["id"]: item for item in DEMO_TEMPLATE_STREAMS[project_id]}
    widgets = []
    for widget_id, widget_type, stream_id, x, y, w, h in layouts[project_id]:
        stream_item = streams[stream_id]
        widgets.append(
            {
                "id": widget_id,
                "type": widget_type,
                "title": stream_item["name"],
                "x": x,
                "y": y,
                "w": w,
                "h": h,
                "deviceId": device_id,
                "channel": stream_item["pin"],
                "datastreamId": stream_id,
                "unit": stream_item.get("unit", ""),
                "min": stream_item.get("min"),
                "max": stream_item.get("max"),
                "color": stream_item["color"],
            }
        )
    return widgets


def default_widgets(device_id: str) -> list[dict]:
    return [
        {"id": "w_temp", "type": "gauge", "title": "Temperature", "x": 0, "y": 0, "w": 3, "h": 3, "deviceId": device_id, "channel": "temperature", "unit": "C", "min": 0, "max": 100},
        {"id": "w_hum", "type": "meter", "title": "Humidity", "x": 3, "y": 0, "w": 3, "h": 3, "deviceId": device_id, "channel": "humidity", "unit": "%", "min": 0, "max": 100},
        {"id": "w_led", "type": "led", "title": "Pump LED", "x": 6, "y": 0, "w": 2, "h": 2, "deviceId": device_id, "channel": "led"},
        {"id": "w_switch", "type": "switch", "title": "Pump Switch", "x": 8, "y": 0, "w": 2, "h": 2, "deviceId": device_id, "channel": "pump"},
        {"id": "w_chart", "type": "chart", "title": "Temperature Graph", "x": 0, "y": 3, "w": 6, "h": 3, "deviceId": device_id, "channel": "temperature", "unit": "C"},
        {"id": "w_gps", "type": "gps", "title": "GPS Map", "x": 6, "y": 2, "w": 3, "h": 3, "deviceId": device_id, "channel": "gps"},
        {"id": "w_camera", "type": "camera", "title": "ESP32-CAM", "x": 9, "y": 2, "w": 3, "h": 3, "deviceId": device_id, "channel": "camera"},
        {"id": "w_time", "type": "time", "title": "Time Input", "x": 0, "y": 6, "w": 2, "h": 2, "deviceId": device_id, "channel": "time"},
        {"id": "w_lcd", "type": "serial_lcd", "title": "Serial Monitor", "x": 2, "y": 6, "w": 4, "h": 2, "deviceId": device_id, "channel": "serial"},
        {"id": "w_value", "type": "value", "title": "Voltage", "x": 6, "y": 6, "w": 2, "h": 2, "deviceId": device_id, "channel": "voltage", "unit": "V"},
    ]


def ensure_demo_templates(db) -> None:
    for project_id, name, description in DEMO_PROJECTS:
        dashboard = db.scalar(select(Dashboard).where(Dashboard.tenant_id == DEMO_TENANT_ID, Dashboard.project_id == project_id))
        device = db.scalar(select(Device).where(Device.tenant_id == DEMO_TENANT_ID, Device.project_id == project_id))
        if not dashboard or not device:
            continue
        existing = db.scalar(select(DeviceTemplateRecord).where(DeviceTemplateRecord.tenant_id == DEMO_TENANT_ID, DeviceTemplateRecord.project_id == project_id))
        if existing:
            continue
        dashboard.widgets = hydrate_template_widgets(project_id, device.id)
        db.add(
            DeviceTemplateRecord(
                id=f"template-{project_id.removeprefix('project-')}",
                tenant_id=DEMO_TENANT_ID,
                project_id=project_id,
                dashboard_id=dashboard.id,
                name=name,
                board=device.board,
                description=f"{name} template for {device.board}",
                datastreams=DEMO_TEMPLATE_STREAMS[project_id],
                notifications=[
                    {
                        "id": f"template-{project_id}-alert",
                        "name": f"{DEMO_TEMPLATE_STREAMS[project_id][0]['name']} Alert",
                        "datastreamId": DEMO_TEMPLATE_STREAMS[project_id][0]["id"],
                        "operator": ">",
                        "threshold": 80,
                        "channel": "push",
                        "cooldownMinutes": 15,
                    }
                ],
            )
        )


def seed() -> None:
    init_db()
    db = SessionLocal()
    try:
        existing_user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
        if existing_user:
            ensure_demo_templates(db)
            db.commit()
            return
        tenant = Tenant(id=DEMO_TENANT_ID, name="Rectronx Demo", plan_code="plus")
        db.add(tenant)
        db.flush()
        user = User(tenant_id=tenant.id, email=DEMO_EMAIL, full_name="Rectronx Demo", password_hash=hash_secret(DEMO_PASSWORD))
        db.add(user)
        projects = [Project(id=project_id, tenant_id=tenant.id, name=name, description=description) for project_id, name, description in DEMO_PROJECTS]
        db.add_all(projects)
        db.flush()
        devices = [Device(id=device_id, tenant_id=tenant.id, project_id=project_id, name=name, board=board, secret_hash=hash_secret(token), is_online=is_online) for device_id, project_id, name, board, token, is_online in DEMO_DEVICES]
        db.add_all(devices)
        db.flush()
        for project, device in zip(projects, devices, strict=True):
            db.add(Dashboard(tenant_id=tenant.id, project_id=project.id, name=f"{project.name} Dashboard", widgets=default_widgets(device.id)))
        for channel, value, unit in [("temperature", {"raw": 29.4}, "C"), ("humidity", {"raw": 63}, "%"), ("led", {"raw": True}, None), ("pump", {"raw": False}, None), ("voltage", {"raw": 12.2}, "V"), ("serial", {"raw": "Boot OK\nWiFi connected\nMQTT connected"}, None), ("gps", {"lat": 3.139, "lng": 101.6869, "speed": 14}, None), ("camera", {"url": "https://placehold.co/640x360?text=ESP32-CAM+Snapshot"}, None)]:
            db.add(Telemetry(tenant_id=tenant.id, project_id=projects[0].id, device_id=devices[0].id, channel=channel, value=value, unit=unit))
        db.add(AlertRule(tenant_id=tenant.id, project_id=projects[0].id, device_id=devices[0].id, channel="temperature", operator=">", threshold=40))
        db.add(Notification(tenant_id=tenant.id, user_id=user.id, title="Welcome to Spark IoT", body="Demo data is ready. Publish MQTT or HTTP telemetry to update widgets."))
        db.flush()
        ensure_demo_templates(db)
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print(f"Seeded demo user {DEMO_EMAIL} / {DEMO_PASSWORD}")
