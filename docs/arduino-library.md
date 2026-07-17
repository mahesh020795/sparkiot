# SparkIoT Arduino Library

SparkIoT Arduino Library v1.0.0 is the beginner-friendly board SDK for Spark IoT. It gives ESP32, ESP8266, and Arduino `Client`-compatible network boards a Blynk-style virtual pin API while keeping the production MQTT protocol hidden inside the library.

## Supported boards in v1

- ESP32
- ESP8266 / NodeMCU
- Arduino Uno R4 WiFi through WiFiS3 Client adapter mode
- Arduino Ethernet and Ethernet shield boards through EthernetClient adapter mode
- Ethernet, WiFiNINA, WiFiS3, MKR GSM/NB, and similar Arduino boards when used through Client adapter mode

Standard Arduino Uno/Nano boards do not have network access by themselves. They need a network shield/module/library first. If that networking stack exposes an Arduino `Client` object, SparkIoT can use it through Client adapter mode.

## Install in Arduino IDE

### Install from ZIP

1. Zip the `arduino/SparkIoT` folder as `SparkIoT.zip`.
2. In Arduino IDE, open `Sketch -> Include Library -> Add .ZIP Library...`.
3. Select `SparkIoT.zip`.
4. Install `PubSubClient` by Nick O'Leary from Library Manager.

### Manual install

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
   - For other boards, install the board/network library that provides `EthernetClient`, `WiFiClient`, `WiFiSSLClient`, `WiFiNINA`, `WiFiS3`, or another `Client` implementation.
6. Open one of:
   - `File -> Examples -> SparkIoT -> ESP32_Smart_Irrigation`
   - `File -> Examples -> SparkIoT -> ESP8266_Home_Relay`
   - `File -> Examples -> SparkIoT -> GPS_Tracker`
   - `File -> Examples -> SparkIoT -> Camera_URL`
   - `File -> Examples -> SparkIoT -> Generic_Client_Adapter`

## Minimal example

```cpp
#include <SparkIoT.h>

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* BROKER_HOST = "iot.rectronx.com";
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
SparkIoT.begin(networkClient, mqttHost, mqttPort, tenantId, deviceId, token);
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

String telemetry, camera URLs, and ACK messages are escaped before publishing, so quotes, backslashes, and newlines do not break MQTT JSON payloads.

## Client adapter mode

Use Client adapter mode when the board is not an ESP32/ESP8266 or when you want to manage the network connection yourself.

SparkIoT does not care whether the transport comes from Ethernet, WiFiNINA, WiFiS3, GSM/LTE, or another Arduino library. The requirement is that your network object inherits from Arduino `Client` and is already connected to the network before SparkIoT starts MQTT.

Ethernet-style example:

```cpp
#include <SPI.h>
#include <Ethernet.h>
#include <SparkIoT.h>

byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };
EthernetClient networkClient;

void setup() {
  Serial.begin(115200);
  Ethernet.begin(mac);
  SparkIoT.begin(networkClient, BROKER_HOST, BROKER_PORT, SPARK_TENANT_ID, SPARK_DEVICE_ID, SPARK_DEVICE_TOKEN);
}
```

WiFiNINA-style boards use the same SparkIoT call after their own WiFi connection succeeds:

```cpp
// WiFiNINA connection code first...
SparkIoT.begin(networkClient, BROKER_HOST, BROKER_PORT, SPARK_TENANT_ID, SPARK_DEVICE_ID, SPARK_DEVICE_TOKEN);
```

## Protocol mapping

The library publishes to the same Spark IoT MQTT topics as the backend:

```text
spark/v1/{tenant_id}/{device_id}/telemetry/{channel}
spark/v1/{tenant_id}/{device_id}/command/{channel}
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
- Do not use `localhost` from a real board. From ESP32/ESP8266, `localhost` means the board itself; use your VPS IP or production domain, such as `iot.rectronx.com` for the current test server.
- Do not hard-code production tokens in public repositories.
- Rotate device tokens from the Spark IoT device provisioning screen when a board is lost or shared.
- Use the Code tab to generate the correct tenant, device, token, and virtual pin mappings from each customer template.
