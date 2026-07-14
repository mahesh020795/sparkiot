# SparkIoT Arduino Library v1 Design

## Goal

Build a real Arduino IDE installable library named `SparkIoT` so ESP32 and ESP8266 users can connect boards to Spark IoT without copying long raw MQTT sketches.

## Scope

Version 1 targets ESP32 and ESP8266/NodeMCU first. Standard Arduino boards without built-in networking are documented as future adapter targets because Uno/Nano need WiFi, Ethernet, GSM, or serial bridge hardware before they can talk to Spark IoT.

## API

The library exposes a small Blynk-like API:

```cpp
SparkIoT.begin(wifiSsid, wifiPassword, mqttHost, mqttPort, tenantId, deviceId, token);
SparkIoT.run();
SparkIoT.virtualWrite("V0", 29.4, "C");
SparkIoT.virtualWrite("V1", true);
SparkIoT.virtualWrite("V2", "Boot OK");
SparkIoT.setLocation("V5", 3.139, 101.6869, 14, 8);
SparkIoT.setCameraUrl("V6", "http://device.local/snapshot.jpg");
SparkIoT.onCommand("V3", onPumpCommand);
SparkIoT.ack("V3", true, "Pump command applied");
```

## Architecture

The library wraps `WiFi`/`ESP8266WiFi` and `PubSubClient`. It builds Spark IoT protocol topics internally using `spark/v1/{tenant_id}/{device_id}/...`, publishes the device token inside telemetry JSON payloads, subscribes to `command/#`, and dispatches commands by virtual pin. It remains lightweight and synchronous for Arduino IDE simplicity.

## Deliverables

- `arduino/SparkIoT/library.properties`
- `arduino/SparkIoT/src/SparkIoT.h`
- `arduino/SparkIoT/src/SparkIoT.cpp`
- Arduino IDE examples for ESP32 irrigation, ESP8266 home relay, GPS, and camera URL
- Code tab generator updated to emit library-based sketches
- Documentation for install, usage, board support, and migration from generated sketches
- Tests proving the library package shape and Code tab output

## Non-goals

- TLS/MQTTS
- OTA firmware updates
- Arduino Library Manager publishing
- WiFiNINA, Ethernet, GSM, STM32, Pico W adapters
- Cloud video relay or camera recording

