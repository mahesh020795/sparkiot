#include <ESP8266WiFi.h>
#include <PubSubClient.h>

// Spark IoT NodeMCU ESP8266 real-board test sketch.
// Arduino IDE libraries:
// - ESP8266 board package
// - PubSubClient by Nick O'Leary
// Change WIFI_* and BROKER_HOST before uploading.

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* BROKER_HOST = "192.168.1.10"; // Your PC/Laptop LAN IP, not 127.0.0.1
const int BROKER_PORT = 1883;

const char* SPARK_TENANT_ID = "demo-tenant";
const char* SPARK_DEVICE_ID = "device-home";
const char* SPARK_DEVICE_TOKEN = "spk_dev_home_demo_2c8b";
const char* commandTopic = "spark/v1/demo-tenant/device-home/command/#";

const char* TOPIC_TELEMETRY_V0 = "spark/v1/demo-tenant/device-home/telemetry/V0";
const char* TOPIC_TELEMETRY_V1 = "spark/v1/demo-tenant/device-home/telemetry/V1";
const char* TOPIC_TELEMETRY_V2 = "spark/v1/demo-tenant/device-home/telemetry/V2";

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
unsigned long lastPublishMs = 0;

void publishJson(const char* topic, const char* valueJson, const char* unit) {
  char payload[220];
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

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String topicText = String(topic);
  String payloadText;
  for (unsigned int i = 0; i < length; i++) payloadText += (char)payload[i];

  Serial.print("Command ");
  Serial.print(topicText);
  Serial.print(" -> ");
  Serial.println(payloadText);

  if (topicText.endsWith("/V0")) {
    bool relayOn = payloadText == "1" || payloadText == "true" || payloadText.indexOf("\"value\":true") >= 0;
    digitalWrite(LED_BUILTIN, relayOn ? LOW : HIGH);
    publishJson(TOPIC_TELEMETRY_V0, relayOn ? "true" : "false", "");
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
    publishJson(TOPIC_TELEMETRY_V0, "true", "");
    publishJson(TOPIC_TELEMETRY_V1, "82", "%");
    publishJson(TOPIC_TELEMETRY_V2, "\"Closed\"", "");
  }
}
