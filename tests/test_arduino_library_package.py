from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LIBRARY = ROOT / "arduino" / "SparkIoT"


def test_sparkiot_arduino_library_has_installable_package_shape():
    assert (LIBRARY / "library.properties").exists()
    assert (LIBRARY / "src" / "SparkIoT.h").exists()
    assert (LIBRARY / "src" / "SparkIoT.cpp").exists()

    manifest = (LIBRARY / "library.properties").read_text(encoding="utf-8")
    assert "name=SparkIoT" in manifest
    assert "architectures=esp32,esp8266" in manifest
    assert "depends=PubSubClient" in manifest


def test_sparkiot_library_exposes_clean_blynk_style_api():
    header = (LIBRARY / "src" / "SparkIoT.h").read_text(encoding="utf-8")
    implementation = (LIBRARY / "src" / "SparkIoT.cpp").read_text(encoding="utf-8")

    for expected in [
        "bool begin(",
        "void run()",
        "bool virtualWrite(const char* channel, float value",
        "bool virtualWrite(const char* channel, bool value",
        "bool virtualWrite(const char* channel, const char* value",
        "bool setLocation(",
        "bool setCameraUrl(",
        "void onCommand(",
        "bool ack(",
        "extern SparkIoTClient SparkIoT;",
    ]:
        assert expected in header

    for expected in [
        "spark/v1/",
        "/telemetry/",
        "/command/#",
        "/ack/",
        "PubSubClient",
        "SparkIoTClient SparkIoT;",
    ]:
        assert expected in implementation


def test_sparkiot_library_ships_beginner_friendly_examples():
    examples = {
        "ESP32_Smart_Irrigation/ESP32_Smart_Irrigation.ino": ["#include <SparkIoT.h>", "SparkIoT.virtualWrite(\"V0\"", "SparkIoT.onCommand(\"V3\"", "SparkIoT.ack(\"V3\""],
        "ESP8266_Home_Relay/ESP8266_Home_Relay.ino": ["#include <SparkIoT.h>", "SparkIoT.virtualWrite(\"V1\"", "SparkIoT.onCommand(\"V0\""],
        "GPS_Tracker/GPS_Tracker.ino": ["#include <SparkIoT.h>", "SparkIoT.setLocation(\"V0\""],
        "Camera_URL/Camera_URL.ino": ["#include <SparkIoT.h>", "SparkIoT.setCameraUrl(\"V0\""],
    }

    for relative_path, expected_snippets in examples.items():
        content = (LIBRARY / "examples" / relative_path).read_text(encoding="utf-8")
        for snippet in expected_snippets:
            assert snippet in content

