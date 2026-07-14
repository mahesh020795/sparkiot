# Spark IoT MVP

Spark IoT is a Rectronx IoT SaaS starter for a lower-cost Blynk-style product. The current web-first build opens directly to the dashboard with local demo data, so customers can see the core control experience before login, project creation, templates and billing are added.

The repository also includes the FastAPI modular monolith, PostgreSQL, Valkey, Mosquitto MQTT, WebSocket realtime foundation, seed data, MQTT ingestion bridge, and Arduino examples for real ESP32/ESP8266 testing.

## Starter Plan

- 1 user
- 3 devices
- 3 projects with 1 dashboard each
- 10 widgets per dashboard
- 30-day telemetry and GPS retention
- GPS, camera URL, push notifications, gauges, meters, charts, switch, push button, LED, serial/LCD, date, time, day and numeric panels

## Local Setup

```bash
cp .env.example .env
docker compose up --build
```

Open:

- Frontend: http://localhost:5173
- API docs: http://localhost:8000/api/docs
- Health: http://localhost:8000/health/ready

The frontend currently starts without login and shows the Smart Irrigation dashboard first.

Backend demo login for API testing:

```text
Email: demo@sparkiot.dev
Password: SparkDemo123!
Tenant: demo-tenant
ESP32 irrigation device: device-irrigation
ESP32 irrigation token: spk_dev_irrigation_demo_9f3a
```

## Publish Demo Telemetry

HTTP:

```bash
curl -X POST http://localhost:8000/api/v1/telemetry/ingest \
  -H "Content-Type: application/json" \
  -d "{\"device_id\":\"device-irrigation\",\"token\":\"spk_dev_irrigation_demo_9f3a\",\"channel\":\"V0\",\"value\":31.5,\"unit\":\"C\"}"
```

MQTT:

```bash
mosquitto_pub -h 127.0.0.1 -p 1883 -t spark/v1/demo-tenant/device-irrigation/telemetry/V0 -m "{\"token\":\"spk_dev_irrigation_demo_9f3a\",\"value\":31.8,\"unit\":\"C\",\"message_id\":\"pc-test-1\"}"
```

MQTT topic shape:

```text
spark/v1/{tenant_id}/{device_id}/telemetry/{channel}
spark/v1/{tenant_id}/{device_id}/command/{channel}
spark/v1/{tenant_id}/{device_id}/ack/{channel}
spark/v1/{tenant_id}/{device_id}/status
```

## Test With ESP32 / NodeMCU ESP8266

Open `Templates -> Code` in the web app to generate a board-specific Arduino IDE sketch for the selected template and device.

Included examples:

- `examples/arduino/SparkIoT_ESP32/SparkIoT_ESP32.ino`
- `examples/arduino/SparkIoT_ESP8266/SparkIoT_ESP8266.ino`

Before uploading, replace WiFi credentials and set `BROKER_HOST` to your PC/Laptop LAN IP address, not `127.0.0.1`.

See:

- `docs/board-testing.md`
- `docs/deployment.md`
- `docs/mqtt-protocol.md`
- `docs/api.md`

## Production Notes

Docker Compose is for local deployment and VPS evaluation. Production requires HTTPS, rotated secrets, off-server PostgreSQL backups, restore tests, monitoring, dependency updates, commercial-safe map tiles, and privacy/acceptable-use documents. Camera streaming in this MVP supports snapshot or direct-stream URLs only; relay, recording and transcoding need a separate bandwidth cost study.

## Development Workflow

Use these commands for repeatable local work:

```bash
make up
make test
make build
make package
```

The repository includes:

- GitHub CI: `.github/workflows/ci.yml`
- Optional GitHub-to-VPS deploy: `.github/workflows/deploy-vps.yml`
- VPS deploy script: `scripts/deploy_vps.sh`
- Linux-safe release packager: `scripts/package_release.py`

## GitHub to VPS Deployment

Push code to GitHub:

```bash
git remote add origin https://github.com/mahesh020795/sparkiot.git
git add .
git commit -m "Initial Spark IoT MVP"
git branch -M main
git push -u origin main
```

On the VPS, first-time setup:

```bash
git clone https://github.com/mahesh020795/sparkiot.git ~/spark-iot
cd ~/spark-iot
cp .env.example .env
nano .env
docker compose up -d --build
```

For the current demo VPS:

```env
CORS_ORIGINS=http://localhost:5173,http://localhost:8080,http://34.73.29.12:5173,http://34.73.29.12:8000
VITE_API_BASE=http://34.73.29.12:8000/api/v1
```

After GitHub is connected, deploy updates on the VPS with:

```bash
cd ~/spark-iot
bash scripts/deploy_vps.sh
```

For automatic production deployment, configure the GitHub repository secrets in `docs/deployment.md`. After that, every push to `main` runs CI first and deploys to the VPS only when CI passes.
