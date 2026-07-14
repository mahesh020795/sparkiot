from sqlalchemy import select

from app.core.database import SessionLocal, init_db
from app.core.security import hash_secret
from app.models.domain import AlertRule, Dashboard, Device, Notification, Project, Telemetry, Tenant, User

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


def seed() -> None:
    init_db()
    db = SessionLocal()
    try:
        if db.scalar(select(User).where(User.email == DEMO_EMAIL)):
            return
        tenant = Tenant(id=DEMO_TENANT_ID, name="Rectronx Demo", plan_code="starter")
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
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print(f"Seeded demo user {DEMO_EMAIL} / {DEMO_PASSWORD}")
