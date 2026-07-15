# Spark IoT Board Testing Guide

Use this guide to test Spark IoT with a real ESP32 or NodeMCU ESP8266 on your local WiFi.

## 1. Start Spark IoT locally

```bash
cp .env.example .env
docker compose up --build
```

Open the web app:

```text
http://localhost
http://localhost:5173
```

For a VPS deployment, open:

```text
http://YOUR_VPS_IP
http://YOUR_VPS_IP:5173
```

Then open the `Live Test` tab. It shows the MQTT broker host, port, tenant ID, device ID, device token, telemetry topic, command topic, and latest received virtual pin values.

For signed-in account testing, open `Projects` first if you need a new workspace, then open `Devices` and use `Provision device` to create a real board credential for that project. Copy the token as soon as it appears and update your Arduino sketch. Use `Regenerate token` when you need a fresh credential for an existing board. The backend stores only token hashes, so visible values are one-time credentials and old sketches should be reflashed after rotation.

Mosquitto MQTT is exposed on:

```text
port 1883
```

The FastAPI service also runs the local MQTT ingestion bridge by default:

```text
MQTT_CONSUMER_ENABLED=true
```

That bridge subscribes to `spark/v1/+/+/telemetry/+` and `spark/v1/+/+/ack/+`, validates device traffic, stores telemetry, and records board command acknowledgements.

## 2. Find your PC LAN IP

The board cannot connect to `localhost` or `127.0.0.1`.

On Windows PowerShell:

```powershell
ipconfig
```

Find your WiFi adapter IPv4 address, for example:

```text
192.168.1.10
```

Use that value as `BROKER_HOST` in the Arduino sketch.

For the current Google Cloud VPS test, use the VM external IP as the broker host:

```cpp
const char* mqtt_server = "34.73.29.12";
const int mqtt_port = 1883;
```

## 3. Install Arduino IDE libraries

Install:

- ESP32 board package for ESP32 tests.
- ESP8266 board package for NodeMCU tests.
- `PubSubClient` by Nick O'Leary.
- SparkIoT from this repository:
  - Copy `arduino/SparkIoT` to `Documents/Arduino/libraries/SparkIoT`.
  - Restart Arduino IDE.

## 4. Use the generated Code tab

In Spark IoT:

1. Open `Templates`.
2. Open a template.
3. Open the `Code` tab.
4. Copy the generated sketch. It uses the clean `SparkIoT.h` library API instead of long raw MQTT code.
5. Replace:
   - `YOUR_WIFI_NAME`
   - `YOUR_WIFI_PASSWORD`
   - `BROKER_HOST`
6. Upload to the board.

The generated sketch includes command acknowledgement support for boolean virtual pins. When a dashboard switch sends a command, the board echoes the updated telemetry value and publishes an ACK packet back to Spark IoT so the `Live Test` command monitor can prove the full loop.

For complete library install and API details, see `docs/arduino-library.md`.

## 5. Seeded demo devices

### ESP32 Smart Irrigation

Example file:

```text
arduino/SparkIoT/examples/ESP32_Smart_Irrigation/ESP32_Smart_Irrigation.ino
examples/arduino/SparkIoT_ESP32/SparkIoT_ESP32.ino
```

Device:

```text
device-irrigation
```

Token:

```text
spk_dev_irrigation_demo_9f3a
```

Telemetry topics:

```text
spark/v1/demo-tenant/device-irrigation/telemetry/V0
spark/v1/demo-tenant/device-irrigation/telemetry/V1
spark/v1/demo-tenant/device-irrigation/telemetry/V2
spark/v1/demo-tenant/device-irrigation/telemetry/V3
spark/v1/demo-tenant/device-irrigation/telemetry/V5
```

Command topic:

```text
spark/v1/demo-tenant/device-irrigation/command/#
```

ACK topic:

```text
spark/v1/demo-tenant/device-irrigation/ack/V3
```

### NodeMCU ESP8266 Smart Home

Example file:

```text
arduino/SparkIoT/examples/ESP8266_Home_Relay/ESP8266_Home_Relay.ino
examples/arduino/SparkIoT_ESP8266/SparkIoT_ESP8266.ino
```

Device:

```text
device-home
```

Token:

```text
spk_dev_home_demo_2c8b
```

Telemetry topics:

```text
spark/v1/demo-tenant/device-home/telemetry/V0
spark/v1/demo-tenant/device-home/telemetry/V1
spark/v1/demo-tenant/device-home/telemetry/V2
```

Command topic:

```text
spark/v1/demo-tenant/device-home/command/#
```

ACK topic:

```text
spark/v1/demo-tenant/device-home/ack/V0
```

## 6. Manual MQTT telemetry test from PC

If you install Mosquitto clients locally, publish telemetry into the same topic shape used by ESP32/ESP8266:

```bash
mosquitto_pub -h 127.0.0.1 -p 1883 -t spark/v1/demo-tenant/device-irrigation/telemetry/V0 -m "{\"token\":\"spk_dev_irrigation_demo_9f3a\",\"value\":31.8,\"unit\":\"C\",\"message_id\":\"pc-test-1\"}"
```

The backend should accept the message and the dashboard can receive it through the realtime path.

In the no-login MVP dashboard, widgets poll the demo latest endpoint every few seconds. After publishing telemetry, open `Live Test` or the dashboard and wait briefly for the value to refresh.

For GPS:

```bash
mosquitto_pub -h 127.0.0.1 -p 1883 -t spark/v1/demo-tenant/device-irrigation/telemetry/V5 -m "{\"token\":\"spk_dev_irrigation_demo_9f3a\",\"value\":{\"lat\":3.139,\"lng\":101.6869,\"speed\":14}}"
```

For camera snapshot URL:

```bash
mosquitto_pub -h 127.0.0.1 -p 1883 -t spark/v1/demo-tenant/device-irrigation/telemetry/V6 -m "{\"token\":\"spk_dev_irrigation_demo_9f3a\",\"value\":{\"url\":\"https://placehold.co/640x360?text=ESP32-CAM\"}}"
```

## 7. One-command board loop smoke test

Use this when you want one repeatable check for the complete path:

```text
telemetry -> command -> ACK -> command log
```

Local Docker Compose:

```bash
python scripts/board_loop_smoke.py
```

Current Google Cloud VPS:

```bash
python scripts/board_loop_smoke.py --api-base http://34.73.29.12/api/v1
```

Use the Nginx-proxied `/api/v1` URL for production-style VPS tests. Direct port `8000` is intentionally not required from the public internet.

The script publishes demo telemetry to `telemetry/V0`, calls the demo command API for `command/V3`, simulates the board ACK to `ack/V3`, then confirms the ACK appears in `/demo/devices/{device_id}/command-logs`.

## 8. Manual MQTT command test from PC

If you install Mosquitto clients locally, you can test command delivery:

```bash
mosquitto_pub -h 127.0.0.1 -p 1883 -t spark/v1/demo-tenant/device-irrigation/command/V3 -m "{\"value\":true}"
```

The board serial monitor should show the command and toggle `LED_BUILTIN`.

## 9. Dashboard command test

To prove Spark IoT dashboard controls are publishing MQTT commands, open a terminal on the VPS and subscribe to the command topic:

```bash
docker compose exec mosquitto mosquitto_sub \
  -h localhost \
  -t spark/v1/demo-tenant/device-irrigation/command/#
```

Then open the Spark IoT dashboard in your browser and click the Pump Control switch. The terminal should print payloads like:

```json
{"value":true}
{"value":false}
```

The `Live Test` tab also has a `Command monitor`. It should show:

- `published` when the dashboard sends the command.
- `Board ACK` when the ESP32/NodeMCU publishes its acknowledgement.

For ESP32 Smart Irrigation, the pump switch uses:

```text
spark/v1/demo-tenant/device-irrigation/command/V3
```

For NodeMCU ESP8266 Smart Home, the relay switch uses:

```text
spark/v1/demo-tenant/device-home/command/V0
```

## 10. Manual ACK test from VPS

If you want to test the ACK monitor without a board, publish this from the VPS:

```bash
docker compose exec mosquitto mosquitto_pub \
  -h localhost \
  -t spark/v1/demo-tenant/device-irrigation/ack/V3 \
  -m '{"status":"ok","value":true,"message":"Manual ACK test"}'
```

Then open `Live Test` and check the `Command monitor`.

## 11. Troubleshooting

- Board says MQTT failed: check `BROKER_HOST`, firewall, and Docker Compose `mosquitto` service.
- Board WiFi never connects: check SSID/password and use 2.4 GHz WiFi for ESP8266.
- Telemetry rejected: check the topic device ID, tenant ID, and token. They must match the seeded demo device.
- Web app does not update from MQTT: check `MQTT_CONSUMER_ENABLED=true`, API logs, and whether the dashboard is connected to the same backend process.
- Dashboard switch does not reach the board: subscribe to the command topic with `mosquitto_sub`, check `VITE_API_BASE`, and confirm the frontend can reach `/api/v1` through the Nginx proxy.
- Command monitor shows `published` but no `Board ACK`: the board received or acted on the command but did not publish to the `ack` topic, or the board sketch is old.
- Do not use `localhost` in Arduino sketches. Use your PC LAN IP.
