# Spark IoT MVP

Spark IoT is a Rectronx IoT SaaS starter for a lower-cost Blynk-style product. The current web-first build opens directly to the dashboard with local demo data, so customers can see the core control experience before login, project creation, templates and billing are added.

The repository also includes the FastAPI modular monolith, PostgreSQL, Valkey, Mosquitto MQTT, WebSocket realtime foundation, seed data, MQTT ingestion bridge, persisted Template Studio data, and an installable SparkIoT Arduino IDE library for real ESP32/ESP8266 testing plus Arduino `Client` adapter boards such as Ethernet and WiFiNINA.

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

- Frontend: http://localhost
- Frontend compatibility alias: http://localhost:5173
- API docs: http://localhost:8000/api/docs
- Health: http://localhost:8000/health/ready

The frontend currently starts without login and shows the Smart Irrigation dashboard first.
The Docker frontend image serves the built React app with Nginx. Vite dev server is not used in the production Compose stack.
Nginx proxies browser calls from `/api/v1` to the FastAPI container, so the normal web app path does not require browser CORS.

Backend demo login for API testing:

```text
Email: demo@sparkiot.dev
Password: SparkDemo123!
Tenant: demo-tenant
ESP32 irrigation device: device-irrigation
ESP32 irrigation token: spk_dev_irrigation_demo_9f3a
```

## SaaS Authentication

Spark IoT includes production-shaped SaaS auth surfaces:

- Existing account login
- Starter workspace signup
- Password reset request
- Password reset confirmation

Password reset tokens are stored only as SHA-256 hashes and expire after 30 minutes. Confirming a reset updates the Argon2 password hash and revokes the user's existing refresh tokens so old sessions are signed out.

For MVP/VPS testing, `/api/v1/auth/password-reset/request` returns the one-time reset token directly so the flow can be tested before email is configured. Before selling to public customers, connect SMTP or a transactional email provider and stop exposing raw reset tokens in API responses.

### First-login SaaS onboarding

New accounts start in a guided Starter Workspace. Spark IoT creates the tenant, owner user, Starter plan and onboarding state, but it does not create a real project/device/dashboard until the user chooses a project and board.

The demo dashboard remains available from the Starter Workspace as a clearly labelled preview using simulated telemetry. It is separate from customer-owned tenant data.

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

## Persistent Template Studio

The no-login web MVP loads and saves Template Studio data through demo-safe backend routes:

- `GET /api/v1/demo/templates`
- `GET /api/v1/demo/templates/{template_id}`
- `PUT /api/v1/demo/templates/{template_id}`

Signed-in customer workspaces use real tenant-scoped template routes:

- `GET /api/v1/templates`
- `POST /api/v1/templates`
- `GET /api/v1/templates/{template_id}`
- `PUT /api/v1/templates/{template_id}`

The recommended account flow is now `Projects -> Templates -> Devices -> Code -> Live Test`. Create the project first, create one template for that project, configure datastreams/dashboard/notifications in Template Studio, then provision the physical board. Saved data includes template name, board, description, virtual pins/datastreams, notification rules, and dashboard widget layout/config. The API uses optimistic `revision` checks so stale browser tabs cannot silently overwrite newer template changes.


## Data History and CSV Export

The Data History page now works in the no-login demo flow. It shows recent telemetry for the selected device, filters by datastream/channel, and exports CSV from:

```text
GET /api/v1/demo/devices/{device_id}/history
GET /api/v1/demo/devices/{device_id}/history.csv
```

Signed-in customer workspaces use protected tenant-scoped history and export routes:

```text
GET /api/v1/telemetry/devices/{device_id}/history
GET /api/v1/telemetry/devices/{device_id}/history.csv
```

The account CSV route verifies the device belongs to the authenticated tenant before returning data.

Example:

```bash
curl "http://localhost:8000/api/v1/demo/devices/device-irrigation/history.csv?channel=V0" -o irrigation-v0-history.csv
```

## Test With ESP32 / NodeMCU ESP8266 / Arduino Client Boards

Open `Templates -> Code` in the web app to generate a board-specific Arduino IDE sketch for the selected template and device. The generated sketch now uses the reusable `SparkIoT` Arduino library:

```cpp
#include <SparkIoT.h>

SparkIoT.begin(WIFI_SSID, WIFI_PASSWORD, BROKER_HOST, BROKER_PORT, SPARK_TENANT_ID, SPARK_DEVICE_ID, SPARK_DEVICE_TOKEN);
SparkIoT.virtualWrite("V0", 29.4, "C");
SparkIoT.onCommand("V3", onPumpCommand);
SparkIoT.ack("V3", true, "Pump command applied");
```

For Ethernet, WiFiNINA, WiFiS3, MKR GSM/NB, and similar boards, connect the network first and pass the board's `Client` object into Spark IoT:

```cpp
EthernetClient networkClient;
SparkIoT.begin(networkClient, BROKER_HOST, BROKER_PORT, SPARK_TENANT_ID, SPARK_DEVICE_ID, SPARK_DEVICE_TOKEN);
```

Installable Arduino library:

- `arduino/SparkIoT/library.properties`
- `arduino/SparkIoT/src/SparkIoT.h`
- `arduino/SparkIoT/src/SparkIoT.cpp`

Included examples:

- `arduino/SparkIoT/examples/ESP32_Smart_Irrigation/ESP32_Smart_Irrigation.ino`
- `arduino/SparkIoT/examples/ESP8266_Home_Relay/ESP8266_Home_Relay.ino`
- `arduino/SparkIoT/examples/GPS_Tracker/GPS_Tracker.ino`
- `arduino/SparkIoT/examples/Camera_URL/Camera_URL.ino`
- `arduino/SparkIoT/examples/Generic_Client_Adapter/Generic_Client_Adapter.ino`
- `examples/arduino/SparkIoT_ESP32/SparkIoT_ESP32.ino`
- `examples/arduino/SparkIoT_ESP8266/SparkIoT_ESP8266.ino`

Before uploading, replace WiFi credentials and set `BROKER_HOST` to your PC/Laptop LAN IP address, not `127.0.0.1`. For the current Google Cloud VPS test, use `34.73.29.12`.

For authenticated customer workspaces, open `Projects` to create up to three Starter plan project spaces. Then open `Templates`, click `Create template`, select the project, board and starter preset, and save the generated Blynk-style virtual-pin model. After that, open `Devices`, click `Provision device`, select the project and board, and copy the one-time token immediately into the Arduino sketch or Code tab output. To replace a lost/shared credential later, click `Regenerate token`. Spark IoT stores only token hashes, so raw tokens are hidden again after refresh and old board credentials stop working after rotation.

See:

- `docs/arduino-library.md`
- `docs/board-testing.md`
- `docs/deployment.md`
- `docs/mqtt-protocol.md`
- `docs/api.md`

## Production Notes

Docker Compose is for local deployment and VPS evaluation. Production requires HTTPS, rotated secrets, off-server PostgreSQL backups, restore tests, monitoring, dependency updates, commercial-safe map tiles, and privacy/acceptable-use documents. Camera streaming in this MVP supports snapshot or direct-stream URLs only; relay, recording and transcoding need a separate bandwidth cost study.

For VPS deployment, `scripts/deploy_vps.sh` uses `docker-compose.prod.yml` on top of the local Compose file. In that production profile, PostgreSQL and Valkey are not exposed publicly, and the direct API port 8000 is bound to localhost only. Browser traffic and HTTP fallback from boards should use `http://YOUR_VPS_IP/api/v1` through the frontend Nginx proxy; MQTT board traffic continues to use port 1883.

Browser Web Push is production-shaped but requires VAPID keys before real browser delivery is enabled:

```env
VAPID_PRIVATE_KEY=your-private-vapid-key
VAPID_PUBLIC_KEY=your-public-vapid-key
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

Without VAPID keys, Spark IoT still creates in-app notifications and alert history, but skips browser push delivery safely.

After signing in, open `Settings -> Browser push` and click `Enable browser push` to register the browser service worker and save the subscription to `/api/v1/notifications/push-subscriptions`.

Schedule automation is available through `/api/v1/schedules`. A schedule targets one project device channel, uses a local `time_of_day`, supports `daily`, `weekdays`, `weekends`, or day-code recurrence such as `mon,wed,fri`, and the worker publishes the command once per occurrence with an idempotent command-log key.

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
bash scripts/deploy_vps.sh
```

For the current demo VPS:

```env
CORS_ORIGINS=http://localhost,http://localhost:5173,http://localhost:8080,http://34.73.29.12,http://34.73.29.12:5173
VITE_API_BASE=/api/v1
```

On the current demo VPS, open the production frontend at `http://34.73.29.12`. The old testing URL `http://34.73.29.12:5173` is kept as a temporary compatibility alias that serves the same Nginx-built app, not the Vite dev server.

After GitHub is connected, deploy updates on the VPS with:

```bash
cd ~/spark-iot
bash scripts/deploy_vps.sh
```

For automatic production deployment, configure the GitHub repository secrets in `docs/deployment.md`. After that, every push to `main` runs CI first and deploys to the VPS only when CI passes.
