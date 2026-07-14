# Spark IoT Board Testing Guide

Use this guide to test Spark IoT with a real ESP32 or NodeMCU ESP8266 on your local WiFi.

## 1. Start Spark IoT locally

```bash
cp .env.example .env
docker compose up --build
```

Open the web app:

```text
http://localhost:5173
```

For a VPS deployment, open:

```text
http://YOUR_VPS_IP:5173
```

Then open the `Live Test` tab. It shows the MQTT broker host, port, tenant ID, device ID, device token, telemetry topic, command topic, and latest received virtual pin values.

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

## 4. Use the generated Code tab

In Spark IoT:

1. Open `Templates`.
2. Open a template.
3. Open the `Code` tab.
4. Copy the generated sketch.
5. Replace:
   - `YOUR_WIFI_NAME`
   - `YOUR_WIFI_PASSWORD`
   - `BROKER_HOST`
6. Upload to the board.

## 5. Seeded demo devices

### ESP32 Smart Irrigation

Example file:

```text
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

## 7. Manual MQTT command test from PC

If you install Mosquitto clients locally, you can test command delivery:

```bash
mosquitto_pub -h 127.0.0.1 -p 1883 -t spark/v1/demo-tenant/device-irrigation/command/V3 -m "{\"value\":true}"
```

The board serial monitor should show the command and toggle `LED_BUILTIN`.

## 8. Dashboard command test

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

## 9. Manual ACK test from VPS

If you want to test the ACK monitor without a board, publish this from the VPS:

```bash
docker compose exec mosquitto mosquitto_pub \
  -h localhost \
  -t spark/v1/demo-tenant/device-irrigation/ack/V3 \
  -m '{"status":"ok","value":true,"message":"Manual ACK test"}'
```

Then open `Live Test` and check the `Command monitor`.

## 10. Troubleshooting

- Board says MQTT failed: check `BROKER_HOST`, firewall, and Docker Compose `mosquitto` service.
- Board WiFi never connects: check SSID/password and use 2.4 GHz WiFi for ESP8266.
- Telemetry rejected: check the topic device ID, tenant ID, and token. They must match the seeded demo device.
- Web app does not update from MQTT: check `MQTT_CONSUMER_ENABLED=true`, API logs, and whether the dashboard is connected to the same backend process.
- Dashboard switch does not reach the board: subscribe to the command topic with `mosquitto_sub`, check `VITE_API_BASE`, and confirm CORS allows the frontend origin.
- Command monitor shows `published` but no `Board ACK`: the board received or acted on the command but did not publish to the `ack` topic, or the board sketch is old.
- Do not use `localhost` in Arduino sketches. Use your PC LAN IP.
