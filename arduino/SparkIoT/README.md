# SparkIoT Arduino Library

SparkIoT Arduino Library v1 is the Arduino IDE package for connecting ESP32 and ESP8266 boards to Spark IoT with a Blynk-style virtual pin API.

## Install

1. Copy this `SparkIoT` folder into `Documents/Arduino/libraries/SparkIoT`.
2. Restart Arduino IDE.
3. Install `PubSubClient` by Nick O'Leary from Library Manager.
4. Install either the ESP32 or ESP8266 board package.
5. Open `File -> Examples -> SparkIoT`.

## Board connection notes

Use the real broker IP or domain from the Spark IoT server. Do not use `localhost` from a real board because `localhost` means the ESP32/ESP8266 itself, not your VPS.

Current test VPS broker:

```cpp
const char* BROKER_HOST = "34.73.29.12";
const int BROKER_PORT = 1883;
```

## API

```cpp
SparkIoT.begin(wifiSsid, wifiPassword, brokerHost, brokerPort, tenantId, deviceId, token);
SparkIoT.run();
SparkIoT.virtualWrite("V0", 29.4, "C");
SparkIoT.virtualWrite("V1", true);
SparkIoT.setLocation("V5", 3.139, 101.6869, 14, 8);
SparkIoT.setCameraUrl("V6", "http://device.local/snapshot.jpg");
SparkIoT.onCommand("V3", onCommand);
SparkIoT.ack("V3", true, "Command applied");
```

String telemetry, camera URLs, and ACK messages are JSON-safe for quotes, backslashes, and newlines before they are published to MQTT.

## Examples

- `ESP32_Smart_Irrigation`
- `ESP8266_Home_Relay`
- `GPS_Tracker`
- `Camera_URL`
