#include <WiFi.h>
#include <PubSubClient.h>

// Spark IoT ESP32 real-board test sketch.
// Arduino IDE libraries:
// - PubSubClient by Nick O'Leary
// Change WIFI_* and BROKER_HOST before uploading.

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* BROKER_HOST = "192.168.1.10"; // Your PC/Laptop LAN IP, not 127.0.0.1
const int BROKER_PORT = 1883;

const char* SPARK_TENANT_ID = "demo-tenant";
const char* SPARK_DEVICE_ID = "device-irrigation";
const char* SPARK_DEVICE_TOKEN = "spk_dev_irrigation_demo_9f3a";
const char* commandTopic = "spark/v1/demo-tenant/device-irrigation/command/#";

const char* TOPIC_TELEMETRY_V0 = "spark/v1/demo-tenant/device-irrigation/telemetry/V0";
const char* TOPIC_TELEMETRY_V1 = "spark/v1/demo-tenant/device-irrigation/telemetry/V1";
const char* TOPIC_TELEMETRY_V2 = "spark/v1/demo-tenant/device-irrigation/telemetry/V2";
const char* TOPIC_TELEMETRY_V3 = "spark/v1/demo-tenant/device-irrigation/telemetry/V3";
const char* TOPIC_TELEMETRY_V5 = "spark/v1/demo-tenant/device-irrigation/telemetry/V5";
const char* TOPIC_ACK_V3 = "spark/v1/demo-tenant/device-irrigation/ack/V3";

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
unsigned long lastPublishMs = 0;

void publishJson(const char* topic, const char* valueJson, const char* unit) {
  char payload[240];
  if (unit && strlen(unit) > 0) {
    snprintf(payload, sizeof(payload), "{\"token\":\"%s\",\"value\":%s,\"unit\":\"%s\"}", SPARK_DEVICE_TOKEN, valueJson, unit);
  } else {
    snprintf(payload, sizeof(payload), "{\"token\":\"%s\",\"value\":%s}", SPARK_DEVICE_TOKEN, valueJson);
  }
  mqtt.publish(topic, payload);
  Serial.print("Published ");
  Serial.print(topic);
  Serial.print(" -> ");
  Serial.println(payload);
}

void publishAck(const char* topic, bool value, const char* message) {
  char payload[180];
  snprintf(payload, sizeof(payload), "{\"status\":\"ok\",\"value\":%s,\"message\":\"%s\"}", value ? "true" : "false", message);
  mqtt.publish(topic, payload);
  Serial.print("ACK ");
  Serial.print(topic);
  Serial.print(" -> ");
  Serial.println(payload);
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String topicText = String(topic);
  String payloadText;
  for (unsigned int i = 0; i < length; i++) payloadText += (char)payload[i];

  Serial.print("Command ");
  Serial.print(topicText);
  Serial.print(" -> ");
  Serial.println(payloadText);

  if (topicText.endsWith("/V3")) {
    bool pumpOn = payloadText == "1" || payloadText == "true" || payloadText.indexOf("\"value\":true") >= 0;
    digitalWrite(LED_BUILTIN, pumpOn ? LOW : HIGH);
    publishJson(TOPIC_TELEMETRY_V3, pumpOn ? "true" : "false", "");
    publishAck(TOPIC_ACK_V3, pumpOn, "Pump command applied");
  }
}

void connectWiFi() {
  Serial.print("WiFi connecting");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("WiFi connected. IP: ");
  Serial.println(WiFi.localIP());
}

void connectMqtt() {
  while (!mqtt.connected()) {
    Serial.print("MQTT connecting...");
    if (mqtt.connect(SPARK_DEVICE_ID, SPARK_DEVICE_ID, SPARK_DEVICE_TOKEN)) {
      Serial.println("connected");
      mqtt.subscribe(commandTopic);
      Serial.print("Subscribed: ");
      Serial.println(commandTopic);
    } else {
      Serial.print("failed rc=");
      Serial.println(mqtt.state());
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);
  connectWiFi();
  mqtt.setServer(BROKER_HOST, BROKER_PORT);
  mqtt.setCallback(onMqttMessage);
}

void loop() {
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  if (millis() - lastPublishMs > 5000) {
    lastPublishMs = millis();
    publishJson(TOPIC_TELEMETRY_V0, "29.4", "C");
    publishJson(TOPIC_TELEMETRY_V1, "63", "%");
    publishJson(TOPIC_TELEMETRY_V2, "71", "%");
    publishJson(TOPIC_TELEMETRY_V5, "{\"lat\":3.139,\"lng\":101.6869,\"speed\":14,\"accuracy\":8}", "");
  }
}
