#include "SparkIoT.h"

// Spark IoT protocol paths. PubSubClient handles the MQTT transport.
// spark/v1/{tenant_id}/{device_id}/telemetry/{channel}
// spark/v1/{tenant_id}/{device_id}/command/#
// spark/v1/{tenant_id}/{device_id}/ack/{channel}

SparkIoTClient* SparkIoTClient::_activeClient = nullptr;
SparkIoTClient SparkIoT;

SparkIoTClient::SparkIoTClient()
  : _networkClient(nullptr),
    _mqtt(),
    _handlerCount(0),
    _managedWiFi(true),
    _wifiSsid(nullptr),
    _wifiPassword(nullptr),
    _mqttHost(nullptr),
    _mqttPort(1883),
    _tenantId(nullptr),
    _deviceId(nullptr),
    _token(nullptr),
    _lastError("Not started"),
    _lastMqttState(0),
    _lastReconnectAttempt(0) {}

#if SPARKIOT_HAS_MANAGED_WIFI
bool SparkIoTClient::begin(
  const char* wifiSsid,
  const char* wifiPassword,
  const char* mqttHost,
  uint16_t mqttPort,
  const char* tenantId,
  const char* deviceId,
  const char* token
) {
  _wifiSsid = wifiSsid;
  _wifiPassword = wifiPassword;
  _mqttHost = mqttHost;
  _mqttPort = mqttPort;
  _tenantId = tenantId;
  _deviceId = deviceId;
  _token = token;
  _managedWiFi = true;
  _networkClient = &_wifiClient;
  _activeClient = this;

  connectWiFi();
  _mqtt.setClient(*_networkClient);
  _mqtt.setServer(_mqttHost, _mqttPort);
  _mqtt.setCallback(SparkIoTClient::mqttCallback);
  _mqtt.setBufferSize(512);
  return connectMqtt();
}
#endif

bool SparkIoTClient::begin(
  Client& networkClient,
  const char* mqttHost,
  uint16_t mqttPort,
  const char* tenantId,
  const char* deviceId,
  const char* token
) {
  _wifiSsid = nullptr;
  _wifiPassword = nullptr;
  _mqttHost = mqttHost;
  _mqttPort = mqttPort;
  _tenantId = tenantId;
  _deviceId = deviceId;
  _token = token;
  _managedWiFi = false;
  _networkClient = &networkClient;
  _activeClient = this;

  _mqtt.setClient(*_networkClient);
  _mqtt.setServer(_mqttHost, _mqttPort);
  _mqtt.setCallback(SparkIoTClient::mqttCallback);
  _mqtt.setBufferSize(512);
  return connectMqtt();
}

void SparkIoTClient::run() {
#if SPARKIOT_HAS_MANAGED_WIFI
  if (_managedWiFi && WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
#endif

  if (!_mqtt.connected()) {
    const unsigned long now = millis();
    if (now - _lastReconnectAttempt > 3000) {
      _lastReconnectAttempt = now;
      connectMqtt();
    }
  }

  _mqtt.loop();
}

bool SparkIoTClient::connected() {
#if SPARKIOT_HAS_MANAGED_WIFI
  return (!_managedWiFi || WiFi.status() == WL_CONNECTED) && _mqtt.connected();
#else
  return _mqtt.connected();
#endif
}

const char* SparkIoTClient::lastError() {
  return _lastError;
}

int SparkIoTClient::mqttState() {
  _lastMqttState = _mqtt.state();
  return _lastMqttState;
}

bool SparkIoTClient::virtualWrite(const char* channel, float value, const char* unit) {
  char valueJson[32];
  dtostrf(value, 0, 3, valueJson);
  return publishJson("telemetry", channel, valueJson, unit);
}

bool SparkIoTClient::virtualWrite(const char* channel, int value, const char* unit) {
  char valueJson[16];
  snprintf(valueJson, sizeof(valueJson), "%d", value);
  return publishJson("telemetry", channel, valueJson, unit);
}

bool SparkIoTClient::virtualWrite(const char* channel, bool value, const char* unit) {
  return publishJson("telemetry", channel, value ? "true" : "false", unit);
}

bool SparkIoTClient::virtualWrite(const char* channel, const char* value, const char* unit) {
  char escapedValue[180];
  char valueJson[220];
  escapeJson(value, escapedValue, sizeof(escapedValue));
  snprintf(valueJson, sizeof(valueJson), "\"%s\"", escapedValue);
  return publishJson("telemetry", channel, valueJson, unit);
}

bool SparkIoTClient::setLocation(const char* channel, float lat, float lng, float speed, float accuracy) {
  char valueJson[160];
  snprintf(
    valueJson,
    sizeof(valueJson),
    "{\"lat\":%.6f,\"lng\":%.6f,\"speed\":%.2f,\"accuracy\":%.2f}",
    lat,
    lng,
    speed,
    accuracy
  );
  return publishJson("telemetry", channel, valueJson, "");
}

bool SparkIoTClient::setCameraUrl(const char* channel, const char* url) {
  char escapedUrl[220];
  char valueJson[260];
  escapeJson(url, escapedUrl, sizeof(escapedUrl));
  snprintf(valueJson, sizeof(valueJson), "{\"url\":\"%s\"}", escapedUrl);
  return publishJson("telemetry", channel, valueJson, "");
}

void SparkIoTClient::onCommand(const char* channel, SparkIoTCommandCallback callback) {
  for (uint8_t index = 0; index < _handlerCount; index++) {
    if (strcmp(_handlers[index].channel, channel) == 0) {
      _handlers[index].callback = callback;
      return;
    }
  }

  if (_handlerCount < MAX_HANDLERS) {
    _handlers[_handlerCount].channel = channel;
    _handlers[_handlerCount].callback = callback;
    _handlerCount++;
  }
}

bool SparkIoTClient::ack(const char* channel, bool value, const char* message) {
  char escapedMessage[120];
  char valueJson[180];
  escapeJson(message, escapedMessage, sizeof(escapedMessage));
  snprintf(
    valueJson,
    sizeof(valueJson),
    "{\"status\":\"ok\",\"value\":%s,\"message\":\"%s\"}",
    value ? "true" : "false",
    escapedMessage
  );
  return publishJson("ack", channel, valueJson, "");
}

bool SparkIoTClient::publishStatus(const char* status) {
  char escapedStatus[80];
  char valueJson[128];
  escapeJson(status, escapedStatus, sizeof(escapedStatus));
  snprintf(valueJson, sizeof(valueJson), "{\"token\":\"%s\",\"status\":\"%s\"}", _token, escapedStatus);
  return publishJson("status", "", valueJson, "");
}

void SparkIoTClient::connectWiFi() {
#if SPARKIOT_HAS_MANAGED_WIFI
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.print("SparkIoT WiFi connecting to ");
  Serial.println(_wifiSsid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(_wifiSsid, _wifiPassword);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("SparkIoT WiFi connected. IP: ");
  Serial.println(WiFi.localIP());
#endif
}

bool SparkIoTClient::connectMqtt() {
  if (_mqtt.connected()) {
    return true;
  }

  Serial.print("SparkIoT MQTT connecting to ");
  Serial.println(_mqttHost);

  if (_mqtt.connect(_deviceId, _deviceId, _token)) {
    char commandTopic[160];
    snprintf(commandTopic, sizeof(commandTopic), "spark/v1/%s/%s/command/#", _tenantId, _deviceId);
    _mqtt.subscribe(commandTopic);
    _lastMqttState = _mqtt.state();
    setLastError("OK");
    Serial.print("SparkIoT MQTT subscribed: ");
    Serial.println(commandTopic);
    return true;
  }

  _lastMqttState = _mqtt.state();
  setLastError("MQTT connect failed. Check broker host, port, device ID and token.");
  Serial.print("SparkIoT MQTT failed, rc=");
  Serial.println(_lastMqttState);
  return false;
}

bool SparkIoTClient::publishJson(const char* kind, const char* channel, const char* valueJson, const char* unit) {
  if (!_mqtt.connected()) {
    connectMqtt();
  }

  if (!_mqtt.connected()) {
    setLastError("MQTT not connected. Call SparkIoT.run() and check broker/token.");
    return false;
  }

  char topic[180];
  char payload[360];
  buildTopic(topic, sizeof(topic), kind, channel);

  if (strcmp(kind, "ack") == 0 || strcmp(kind, "status") == 0) {
    snprintf(payload, sizeof(payload), "%s", valueJson);
  } else if (unit && strlen(unit) > 0) {
    snprintf(payload, sizeof(payload), "{\"token\":\"%s\",\"value\":%s,\"unit\":\"%s\"}", _token, valueJson, unit);
  } else {
    snprintf(payload, sizeof(payload), "{\"token\":\"%s\",\"value\":%s}", _token, valueJson);
  }

  const bool ok = _mqtt.publish(topic, payload);
  if (!ok) {
    setLastError("MQTT publish failed. Payload may be too large or broker disconnected.");
  } else {
    setLastError("OK");
  }
  Serial.print("SparkIoT publish ");
  Serial.print(topic);
  Serial.print(" -> ");
  Serial.println(payload);
  return ok;
}

void SparkIoTClient::buildTopic(char* output, size_t outputSize, const char* kind, const char* channel) {
  if (channel && strlen(channel) > 0) {
    snprintf(output, outputSize, "spark/v1/%s/%s/%s/%s", _tenantId, _deviceId, kind, channel);
  } else {
    snprintf(output, outputSize, "spark/v1/%s/%s/%s", _tenantId, _deviceId, kind);
  }
}

void SparkIoTClient::setLastError(const char* message) {
  _lastError = message ? message : "";
}

void SparkIoTClient::handleMessage(char* topic, byte* payload, unsigned int length) {
  char payloadText[260];
  const unsigned int copyLength = min(length, (unsigned int)(sizeof(payloadText) - 1));
  memcpy(payloadText, payload, copyLength);
  payloadText[copyLength] = '\0';

  const char* channel = extractChannel(topic);
  const bool value = parseBoolPayload(payloadText);

  Serial.print("SparkIoT command ");
  Serial.print(channel);
  Serial.print(" -> ");
  Serial.println(payloadText);

  for (uint8_t index = 0; index < _handlerCount; index++) {
    if (strcmp(_handlers[index].channel, channel) == 0 && _handlers[index].callback) {
      _handlers[index].callback(channel, value, payloadText);
    }
  }
}

const char* SparkIoTClient::extractChannel(char* topic) {
  char* channel = strrchr(topic, '/');
  return channel ? channel + 1 : topic;
}

bool SparkIoTClient::parseBoolPayload(const char* payload) {
  return strcmp(payload, "1") == 0 ||
         strcmp(payload, "true") == 0 ||
         strstr(payload, "\"value\":true") != nullptr ||
         strstr(payload, "\"value\":1") != nullptr;
}

void SparkIoTClient::escapeJson(const char* input, char* output, size_t outputSize) {
  if (!output || outputSize == 0) {
    return;
  }

  if (!input) {
    output[0] = '\0';
    return;
  }

  size_t writeIndex = 0;
  for (size_t readIndex = 0; input[readIndex] != '\0' && writeIndex + 1 < outputSize; readIndex++) {
    const char character = input[readIndex];
    const char* replacement = nullptr;

    switch (character) {
      case '\\':
        replacement = "\\\\";
        break;
      case '"':
        replacement = "\\\"";
        break;
      case '\n':
        replacement = "\\n";
        break;
      case '\r':
        replacement = "\\r";
        break;
      case '\t':
        replacement = "\\t";
        break;
      default:
        break;
    }

    if (replacement) {
      for (size_t index = 0; replacement[index] != '\0' && writeIndex + 1 < outputSize; index++) {
        output[writeIndex++] = replacement[index];
      }
    } else {
      output[writeIndex++] = character;
    }
  }

  output[writeIndex] = '\0';
}

void SparkIoTClient::mqttCallback(char* topic, byte* payload, unsigned int length) {
  if (_activeClient) {
    _activeClient->handleMessage(topic, payload, length);
  }
}
