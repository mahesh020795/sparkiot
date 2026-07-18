#pragma once

#include <Arduino.h>
#include <Client.h>
#include <PubSubClient.h>

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #define SPARKIOT_HAS_MANAGED_WIFI 1
#elif defined(ESP32)
  #include <WiFi.h>
  #define SPARKIOT_HAS_MANAGED_WIFI 1
#else
  #define SPARKIOT_HAS_MANAGED_WIFI 0
  #warning "SparkIoT WiFi helper supports ESP32/ESP8266. Other boards should use SparkIoT.begin(Client& networkClient, ...)."
#endif

typedef void (*SparkIoTCommandCallback)(const char* channel, bool value, const char* payload);

class SparkIoTClient {
public:
  SparkIoTClient();

  bool begin(
    const char* wifiSsid,
    const char* wifiPassword,
    const char* mqttHost,
    uint16_t mqttPort,
    const char* tenantId,
    const char* deviceId,
    const char* token
  );

  bool begin(Client& networkClient, const char* mqttHost, uint16_t mqttPort, const char* tenantId, const char* deviceId, const char* token);

  void run();
  bool connected();

  bool virtualWrite(const char* channel, float value, const char* unit = "");
  bool virtualWrite(const char* channel, int value, const char* unit = "");
  bool virtualWrite(const char* channel, bool value, const char* unit = "");
  bool virtualWrite(const char* channel, const char* value, const char* unit = "");

  bool setLocation(const char* channel, float lat, float lng, float speed = 0, float accuracy = 0);
  bool setCameraUrl(const char* channel, const char* url);

  void onCommand(const char* channel, SparkIoTCommandCallback callback);
  bool ack(const char* channel, bool value, const char* message = "Command applied");
  bool publishStatus(const char* status = "online");
  const char* lastError();
  int mqttState();

private:
  struct CommandHandler {
    const char* channel;
    SparkIoTCommandCallback callback;
  };

  static const uint8_t MAX_HANDLERS = 16;

  #if SPARKIOT_HAS_MANAGED_WIFI
  WiFiClient _wifiClient;
  #endif
  Client* _networkClient;
  PubSubClient _mqtt;
  CommandHandler _handlers[MAX_HANDLERS];
  uint8_t _handlerCount;
  bool _managedWiFi;

  const char* _wifiSsid;
  const char* _wifiPassword;
  const char* _mqttHost;
  uint16_t _mqttPort;
  const char* _tenantId;
  const char* _deviceId;
  const char* _token;
  const char* _lastError;
  int _lastMqttState;

  unsigned long _lastReconnectAttempt;

  void connectWiFi();
  bool connectMqtt();
  void setLastError(const char* message);
  bool publishJson(const char* kind, const char* channel, const char* valueJson, const char* unit = "");
  void buildTopic(char* output, size_t outputSize, const char* kind, const char* channel);
  void handleMessage(char* topic, byte* payload, unsigned int length);
  const char* extractChannel(char* topic);
  bool parseBoolPayload(const char* payload);
  void escapeJson(const char* input, char* output, size_t outputSize);

  static SparkIoTClient* _activeClient;
  static void mqttCallback(char* topic, byte* payload, unsigned int length);
};

extern SparkIoTClient SparkIoT;
