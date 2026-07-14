#include <SparkIoT.h>

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* BROKER_HOST = "34.73.29.12";
const int BROKER_PORT = 1883;

const char* SPARK_TENANT_ID = "demo-tenant";
const char* SPARK_DEVICE_ID = "device-irrigation";
const char* SPARK_DEVICE_TOKEN = "spk_dev_irrigation_demo_9f3a";

unsigned long lastCameraMs = 0;

void setup() {
  Serial.begin(115200);
  SparkIoT.begin(WIFI_SSID, WIFI_PASSWORD, BROKER_HOST, BROKER_PORT, SPARK_TENANT_ID, SPARK_DEVICE_ID, SPARK_DEVICE_TOKEN);
}

void loop() {
  SparkIoT.run();

  if (millis() - lastCameraMs > 10000) {
    lastCameraMs = millis();
    SparkIoT.setCameraUrl("V0", "http://device.local/snapshot.jpg");
  }
}

