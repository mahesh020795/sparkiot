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

## SDK Direction

The future Arduino IDE library should expose:

```cpp
begin(ssid, password, server, tenantId, deviceId, token)
run()
virtualWrite(channel, value)
setLocation(lat, lng)
setCameraUrl(url)
onCommand(channel, callback)
```
## MQTT ingestion bridge

The local MVP API starts an MQTT ingestion bridge when `MQTT_CONSUMER_ENABLED=true`.

It subscribes to:

```text
spark/v1/+/+/telemetry/+
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
