#include <SPI.h>
#include <Ethernet.h>
#include <SparkIoT.h>

// Generic Arduino Client adapter example.
// Use this pattern for Ethernet, WiFiNINA, WiFiS3, MKR GSM/NB, or any network
// library that gives you an Arduino Client-compatible object.

byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };
EthernetClient networkClient;

const char* BROKER_HOST = "34.73.29.12";
const int BROKER_PORT = 1883;

const char* SPARK_TENANT_ID = "demo-tenant";
const char* SPARK_DEVICE_ID = "device-irrigation";
const char* SPARK_DEVICE_TOKEN = "spk_dev_irrigation_demo_9f3a";

unsigned long lastTelemetryMs = 0;
bool outputState = false;

void onOutputCommand(const char* channel, bool value, const char* payload) {
  outputState = value;
  Serial.print("Command payload: ");
  Serial.println(payload);
  SparkIoT.virtualWrite("V3", outputState);
  SparkIoT.ack("V3", outputState, "Generic adapter command applied");
}

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    ; // Wait for native USB serial boards.
  }

  Serial.println("SparkIoT generic Client adapter starting...");
  if (Ethernet.begin(mac) == 0) {
    Serial.println("Ethernet DHCP failed. Check cable, shield and router.");
    while (true) {
      delay(1000);
    }
  }

  Serial.print("Ethernet IP: ");
  Serial.println(Ethernet.localIP());

  SparkIoT.begin(networkClient, BROKER_HOST, BROKER_PORT, SPARK_TENANT_ID, SPARK_DEVICE_ID, SPARK_DEVICE_TOKEN);
  SparkIoT.onCommand("V3", onOutputCommand);
}

void loop() {
  SparkIoT.run();

  if (millis() - lastTelemetryMs > 5000) {
    lastTelemetryMs = millis();
    SparkIoT.virtualWrite("V0", 24.5, "C");
    SparkIoT.virtualWrite("V1", 63, "%");
    SparkIoT.virtualWrite("V3", outputState);
  }
}
