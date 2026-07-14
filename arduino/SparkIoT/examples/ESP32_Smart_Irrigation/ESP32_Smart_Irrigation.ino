#include <SparkIoT.h>

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* BROKER_HOST = "34.73.29.12";
const int BROKER_PORT = 1883;

const char* SPARK_TENANT_ID = "demo-tenant";
const char* SPARK_DEVICE_ID = "device-irrigation";
const char* SPARK_DEVICE_TOKEN = "spk_dev_irrigation_demo_9f3a";

unsigned long lastTelemetryMs = 0;
bool pumpState = false;

void onPumpCommand(const char* channel, bool value, const char* payload) {
  pumpState = value;
  digitalWrite(LED_BUILTIN, pumpState ? LOW : HIGH);
  SparkIoT.virtualWrite("V3", pumpState);
  SparkIoT.ack("V3", pumpState, "Pump command applied");
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);

  SparkIoT.begin(WIFI_SSID, WIFI_PASSWORD, BROKER_HOST, BROKER_PORT, SPARK_TENANT_ID, SPARK_DEVICE_ID, SPARK_DEVICE_TOKEN);
  SparkIoT.onCommand("V3", onPumpCommand);
}

void loop() {
  SparkIoT.run();

  if (millis() - lastTelemetryMs > 5000) {
    lastTelemetryMs = millis();
    SparkIoT.virtualWrite("V0", 29.4, "C");
    SparkIoT.virtualWrite("V1", 63, "%");
    SparkIoT.virtualWrite("V2", 71, "%");
    SparkIoT.setLocation("V5", 3.139, 101.6869, 14, 8);
    SparkIoT.setCameraUrl("V6", "http://device.local/snapshot.jpg");
    SparkIoT.virtualWrite("V7", "Boot OK");
  }
}

