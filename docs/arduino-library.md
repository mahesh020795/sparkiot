# SparkIoT Arduino Library

SparkIoT Arduino Library v1 is the beginner-friendly board SDK for Spark IoT. It gives ESP32 and ESP8266 users a Blynk-style virtual pin API while keeping the production MQTT protocol hidden inside the library.

## Supported boards in v1

- ESP32
- ESP8266 / NodeMCU

Standard Arduino Uno/Nano boards do not have network access by themselves. They can be supported later through WiFiNINA, Ethernet, GSM/LTE, ESP-01, or serial bridge adapters.

## Install in Arduino IDE

1. Open this repository folder.
2. Copy `arduino/SparkIoT` into your Arduino libraries folder:
   - Windows: `Documents/Arduino/libraries/SparkIoT`
   - macOS/Linux: `~/Arduino/libraries/SparkIoT`
3. Restart Arduino IDE.
4. Install dependency from Library Manager:
   - `PubSubClient` by Nick O'Leary
5. Install the board package:
   - ESP32 by Espressif Systems, or
   - ESP8266 by ESP8266 Community
6. Open one of:
   - `File -> Examples -> SparkIoT -> ESP32_Smart_Irrigation`
   - `File -> Examples -> SparkIoT -> ESP8266_Home_Relay`
   - `File -> Examples -> SparkIoT -> GPS_Tracker`
   - `File -> Examples -> SparkIoT -> Camera_URL`

## Minimal example

```cpp
#include <SparkIoT.h>

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* BROKER_HOST = "34.73.29.12";
const int BROKER_PORT = 1883;

const char* SPARK_TENANT_ID = "demo-tenant";
const char* SPARK_DEVICE_ID = "device-irrigation";
const char* SPARK_DEVICE_TOKEN = "spk_dev_irrigation_demo_9f3a";

void onPumpCommand(const char* channel, bool value, const char* payload) {
  digitalWrite(LED_BUILTIN, value ? LOW : HIGH);
  SparkIoT.virtualWrite("V3", value);
  SparkIoT.ack("V3", value, "Pump command applied");
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  SparkIoT.begin(WIFI_SSID, WIFI_PASSWORD, BROKER_HOST, BROKER_PORT, SPARK_TENANT_ID, SPARK_DEVICE_ID, SPARK_DEVICE_TOKEN);
  SparkIoT.onCommand("V3", onPumpCommand);
}

void loop() {
  SparkIoT.run();
  SparkIoT.virtualWrite("V0", 29.4, "C");
  delay(5000);
}
```

## API

```cpp
SparkIoT.begin(wifiSsid, wifiPassword, mqttHost, mqttPort, tenantId, deviceId, token);
SparkIoT.run();
SparkIoT.connected();

SparkIoT.virtualWrite("V0", 29.4, "C");
SparkIoT.virtualWrite("V1", 63, "%");
SparkIoT.virtualWrite("V2", true);
SparkIoT.virtualWrite("V3", "Boot OK");

SparkIoT.setLocation("V5", 3.139, 101.6869, 14, 8);
SparkIoT.setCameraUrl("V6", "http://device.local/snapshot.jpg");

SparkIoT.onCommand("V3", onCommandCallback);
SparkIoT.ack("V3", true, "Command applied");
```

## Protocol mapping

The library publishes to the same Spark IoT MQTT topics as the backend:

```text
spark/v1/{tenant_id}/{device_id}/telemetry/{channel}
spark/v1/{tenant_id}/{device_id}/ack/{channel}
```

It subscribes to:

```text
spark/v1/{tenant_id}/{device_id}/command/#
```

Telemetry still includes the device token:

```json
{"token":"device-token","value":29.4,"unit":"C"}
```

ACK packets do not include the token because they are used as command-log confirmations:

```json
{"status":"ok","value":true,"message":"Pump command applied"}
```

## Notes for production

- Use a domain and TLS before public customer use.
- Do not hard-code production tokens in public repositories.
- Rotate device tokens from the Spark IoT device provisioning screen when a board is lost or shared.
- Use the Code tab to generate the correct tenant, device, token, and virtual pin mappings from each customer template.

