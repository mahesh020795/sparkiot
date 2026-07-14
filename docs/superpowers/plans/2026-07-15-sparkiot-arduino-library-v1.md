# SparkIoT Arduino Library v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an installable Arduino IDE `SparkIoT` library for ESP32 and ESP8266 and update the Spark IoT Code tab to generate clean library-based sketches.

**Architecture:** Keep the SDK lightweight: a single `SparkIoTClient` class wraps WiFi setup, MQTT reconnect, telemetry publishing, command subscription, command dispatch, GPS/camera helpers, and ACK publishing. The frontend generator becomes a thin sketch composer that uses the library API.

**Tech Stack:** Arduino C++, PubSubClient, ESP32 WiFi, ESP8266WiFi, React/Vitest tests, Python package validation.

## Global Constraints

- Keep the MQTT topic contract unchanged: `spark/v1/{tenant_id}/{device_id}/telemetry/{channel}`, `command/{channel}`, `ack/{channel}`.
- Keep v1 focused on ESP32 and ESP8266.
- Do not require paid cloud services.
- Keep sketches simple enough for Arduino IDE beginners.
- Preserve current no-login demo flow and seeded demo tokens.

---

### Task 1: Add failing tests for SDK package and Code tab output

**Files:**
- Create: `tests/test_arduino_library_package.py`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Produces test expectations for `arduino/SparkIoT` files and frontend generated code.

- [ ] Write a Python test that requires `library.properties`, `SparkIoT.h`, `SparkIoT.cpp`, and example sketches.
- [ ] Update the frontend test to expect `#include <SparkIoT.h>`, `SparkIoT.begin`, `SparkIoT.virtualWrite`, `SparkIoT.onCommand`, and `SparkIoT.ack`.
- [ ] Run the tests and verify they fail before implementation.

### Task 2: Implement Arduino library package

**Files:**
- Create: `arduino/SparkIoT/library.properties`
- Create: `arduino/SparkIoT/src/SparkIoT.h`
- Create: `arduino/SparkIoT/src/SparkIoT.cpp`

**Interfaces:**
- `SparkIoTClient::begin(...)`
- `SparkIoTClient::run()`
- `SparkIoTClient::virtualWrite(...)`
- `SparkIoTClient::setLocation(...)`
- `SparkIoTClient::setCameraUrl(...)`
- `SparkIoTClient::onCommand(...)`
- `SparkIoTClient::ack(...)`
- Global instance: `SparkIoT`

- [ ] Add the Arduino library manifest.
- [ ] Add the public header.
- [ ] Add the implementation using PubSubClient and WiFiClient.
- [ ] Run package tests until green.

### Task 3: Add Arduino IDE examples and docs

**Files:**
- Create: `arduino/SparkIoT/examples/ESP32_Smart_Irrigation/ESP32_Smart_Irrigation.ino`
- Create: `arduino/SparkIoT/examples/ESP8266_Home_Relay/ESP8266_Home_Relay.ino`
- Create: `arduino/SparkIoT/examples/GPS_Tracker/GPS_Tracker.ino`
- Create: `arduino/SparkIoT/examples/Camera_URL/Camera_URL.ino`
- Create: `docs/arduino-library.md`
- Modify: `docs/board-testing.md`
- Modify: `docs/mqtt-protocol.md`
- Modify: `README.md`

- [ ] Add examples using the clean library API.
- [ ] Document install steps and board support.
- [ ] Document current ESP32/ESP8266 focus and future adapter plan.

### Task 4: Update frontend Code tab generator

**Files:**
- Modify: `frontend/src/pages/TemplateStudioPage.tsx`
- Modify: `frontend/src/App.test.tsx`

- [ ] Replace raw MQTT generated sketches with `SparkIoT` library sketches.
- [ ] Keep board-specific WiFi include handled by the library, not generated sketch.
- [ ] Include virtual pin publish examples and boolean command handlers.
- [ ] Run frontend tests until green.

### Task 5: Verify, package, commit, push

**Files:**
- Modify generated release artifact under `outputs/`

- [ ] Run backend tests.
- [ ] Run frontend tests.
- [ ] Run frontend build.
- [ ] Run package validation.
- [ ] Package release ZIP.
- [ ] Commit and push to GitHub.
- [ ] Watch CI and deploy workflow.

