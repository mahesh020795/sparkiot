# Spark IoT MQTT Protocol v1

## Topics

```text
spark/v1/{tenant_id}/{device_id}/telemetry/{channel}
spark/v1/{tenant_id}/{device_id}/command/{channel}
spark/v1/{tenant_id}/{device_id}/ack/{channel}
spark/v1/{tenant_id}/{device_id}/status
```

Devices publish telemetry, ack and status in their own namespace. Devices subscribe only to command topics for their own device ID.

## Telemetry Envelope

```json
{
  "value": 29.4,
  "unit": "C",
  "ts": "2026-07-13T02:30:00Z",
  "quality": { "rssi": -64 },
  "message_id": "esp32-0001"
}
```

`message_id` is optional but recommended. Spark IoT treats repeated telemetry with the same tenant, device, channel, and `message_id` as the same reading. This lets ESP32/ESP8266 boards safely retry MQTT publishes after weak WiFi without duplicating history rows or retriggering alert rules.

The telemetry table also defines a database-level unique retry guard for non-empty `message_id` values, so the storage layer protects history even if two retry packets arrive at nearly the same time.

GPS value:

```json
{
  "value": { "lat": 3.139, "lng": 101.6869, "speed": 14, "accuracy": 8 }
}
```

Camera value:

```json
{
  "value": { "url": "https://device-or-gateway/snapshot.jpg" }
}
```

## Arduino SDK

The repository includes SparkIoT Arduino Library v1 at `arduino/SparkIoT`. It exposes:

```cpp
SparkIoT.begin(ssid, password, server, port, tenantId, deviceId, token);
SparkIoT.run();
SparkIoT.virtualWrite("V0", value, "unit");
SparkIoT.setLocation("V5", lat, lng, speed, accuracy);
SparkIoT.setCameraUrl("V6", url);
SparkIoT.onCommand("V3", callback);
SparkIoT.ack("V3", true, "Command applied");
```

Version 1 supports ESP32 and ESP8266 through the built-in WiFi helper and also supports Ethernet, WiFiNINA, WiFiS3, MKR GSM/NB, and similar boards through `SparkIoT.begin(networkClient, ...)` when the board library exposes an Arduino `Client`.

## MQTT ingestion bridge

The local MVP API starts an MQTT ingestion bridge when `MQTT_CONSUMER_ENABLED=true`.

It subscribes to:

```text
spark/v1/+/+/telemetry/+
spark/v1/+/+/ack/+
```

Telemetry payloads must be JSON objects:

```json
{
  "token": "device-token-shown-once",
  "value": 29.4,
  "unit": "C",
  "message_id": "optional-id"
}
```

If a board retries the same telemetry packet, reuse the same `message_id`. If it is a new sensor sample, generate a new `message_id`.

GPS virtual pins can send a value object:

```json
{
  "token": "device-token-shown-once",
  "value": { "lat": 3.139, "lng": 101.6869, "speed": 14 }
}
```

Camera virtual pins can send a snapshot or stream URL:

```json
{
  "token": "device-token-shown-once",
  "value": { "url": "https://example.com/camera.jpg" }
}
```

Command acknowledgements are published by boards after receiving a command:

```json
{
  "status": "ok",
  "value": true,
  "message": "Pump command applied"
}
```

The backend stores ACK packets as command-log entries so the Board Test command monitor can show both the dashboard command and the board confirmation.
