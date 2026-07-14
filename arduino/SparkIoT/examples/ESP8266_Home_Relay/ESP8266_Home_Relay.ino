#include <SparkIoT.h>

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* BROKER_HOST = "34.73.29.12";
const int BROKER_PORT = 1883;

const char* SPARK_TENANT_ID = "demo-tenant";
const char* SPARK_DEVICE_ID = "device-home";
const char* SPARK_DEVICE_TOKEN = "spk_dev_home_demo_2c8b";

unsigned long lastTelemetryMs = 0;
bool relayState = false;

void onRelayCommand(const char* channel, bool value, const char* payload) {
  relayState = value;
  digitalWrite(LED_BUILTIN, relayState ? LOW : HIGH);
  SparkIoT.virtualWrite("V0", relayState);
  SparkIoT.ack("V0", relayState, "Relay command applied");
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);

  SparkIoT.begin(WIFI_SSID, WIFI_PASSWORD, BROKER_HOST, BROKER_PORT, SPARK_TENANT_ID, SPARK_DEVICE_ID, SPARK_DEVICE_TOKEN);
  SparkIoT.onCommand("V0", onRelayCommand);
}

void loop() {
  SparkIoT.run();

  if (millis() - lastTelemetryMs > 5000) {
    lastTelemetryMs = millis();
    SparkIoT.virtualWrite("V1", 82, "%");
    SparkIoT.virtualWrite("V2", "Closed");
  }
}

