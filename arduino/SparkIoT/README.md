# SparkIoT Arduino Library

SparkIoT Arduino Library v1.0.0 is the Arduino IDE package for connecting ESP32, ESP8266, and Arduino `Client`-compatible network boards to Spark IoT with a Blynk-style virtual pin API.

## Install

### Install from ZIP

1. Zip this `SparkIoT` folder as `SparkIoT.zip`.
2. In Arduino IDE, open `Sketch -> Include Library -> Add .ZIP Library...`.
3. Select `SparkIoT.zip`.
4. Install `PubSubClient` by Nick O'Leary from Library Manager.

### Manual install

1. Copy this `SparkIoT` folder into `Documents/Arduino/libraries/SparkIoT`.
2. Restart Arduino IDE.
3. Install `PubSubClient` by Nick O'Leary from Library Manager.
4. For the simplest WiFi helper, install either the ESP32 or ESP8266 board package.
5. For other Arduino boards, install the network library your board uses, such as Ethernet, WiFiNINA, WiFiS3, MKRGSM, or another library that exposes an Arduino `Client`.
6. Open `File -> Examples -> SparkIoT`.

## Board connection notes

Use the real broker IP or domain from the Spark IoT server. Do not use `localhost` from a real board because `localhost` means the ESP32/ESP8266 itself, not your VPS.

Current test VPS broker:

```cpp
const char* BROKER_HOST = "mqtt.rectronx.com";
const int BROKER_PORT = 1883;
```

## API

```cpp
SparkIoT.begin(wifiSsid, wifiPassword, brokerHost, brokerPort, tenantId, deviceId, token);
SparkIoT.begin(networkClient, brokerHost, brokerPort, tenantId, deviceId, token);
SparkIoT.run();
SparkIoT.virtualWrite("V0", 29.4, "C");
SparkIoT.virtualWrite("V1", true);
SparkIoT.setLocation("V5", 3.139, 101.6869, 14, 8);
SparkIoT.setCameraUrl("V6", "http://device.local/snapshot.jpg");
SparkIoT.onCommand("V3", onCommand);
SparkIoT.ack("V3", true, "Command applied");
```

String telemetry, camera URLs, and ACK messages are JSON-safe for quotes, backslashes, and newlines before they are published to MQTT.

## Client adapter mode

ESP32 and ESP8266 users can call the WiFi helper version of `SparkIoT.begin(...)`.

SparkIoT v1.0.0 supports ESP32, ESP8266, Arduino Uno R4 WiFi through WiFiS3 Client adapter mode, Arduino Ethernet boards through EthernetClient adapter mode, and any similar board whose networking stack exposes an Arduino `Client`.

Boards with their own networking stack should connect to the network first, then pass the connected client into Spark IoT:

```cpp
#include <Ethernet.h>
#include <SparkIoT.h>

EthernetClient networkClient;

void setup() {
  Ethernet.begin(mac);
  SparkIoT.begin(networkClient, BROKER_HOST, BROKER_PORT, SPARK_TENANT_ID, SPARK_DEVICE_ID, SPARK_DEVICE_TOKEN);
}
```

The same pattern works with WiFiNINA, WiFiS3, MKR GSM/NB, and other Arduino libraries that provide a `Client` object.

## Examples

- `ESP32_Smart_Irrigation`
- `ESP8266_Home_Relay`
- `GPS_Tracker`
- `Camera_URL`
- `Generic_Client_Adapter`

## Protocol mapping

```text
spark/v1/{tenant_id}/{device_id}/telemetry/{channel}
spark/v1/{tenant_id}/{device_id}/command/{channel}
spark/v1/{tenant_id}/{device_id}/ack/{channel}
```
