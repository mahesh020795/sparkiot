from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LIBRARY = ROOT / "arduino" / "SparkIoT"


def test_sparkiot_arduino_library_has_installable_package_shape():
    assert (LIBRARY / "library.properties").exists()
    assert (LIBRARY / "keywords.txt").exists()
    assert (LIBRARY / "README.md").exists()
    assert (LIBRARY / "src" / "SparkIoT.h").exists()
    assert (LIBRARY / "src" / "SparkIoT.cpp").exists()

    manifest = (LIBRARY / "library.properties").read_text(encoding="utf-8")
    assert "name=SparkIoT" in manifest
    assert "version=1.0.0" in manifest
    assert "architectures=*" in manifest
    assert "depends=PubSubClient" in manifest

    keywords = (LIBRARY / "keywords.txt").read_text(encoding="utf-8")
    for expected in ["SparkIoT\tKEYWORD1", "virtualWrite\tKEYWORD2", "setLocation\tKEYWORD2", "onCommand\tKEYWORD2"]:
        assert expected in keywords


def test_sparkiot_library_exposes_clean_blynk_style_api():
    header = (LIBRARY / "src" / "SparkIoT.h").read_text(encoding="utf-8")
    implementation = (LIBRARY / "src" / "SparkIoT.cpp").read_text(encoding="utf-8")

    for expected in [
        "bool begin(",
        "bool begin(Client& networkClient,",
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
        "escapeJson",
        "\\\\n",
        "\\\\\"",
        "PubSubClient",
        "SparkIoTClient SparkIoT;",
        "_networkClient",
        "_managedWiFi",
    ]:
        assert expected in implementation


def test_sparkiot_library_documents_json_safe_payloads_vps_hosting_and_external_clients():
    docs = (ROOT / "docs" / "arduino-library.md").read_text(encoding="utf-8")
    library_readme = (LIBRARY / "README.md").read_text(encoding="utf-8")

    for content in [docs, library_readme]:
        assert "quotes, backslashes, and newlines" in content
        assert "Do not use `localhost` from a real board" in content
        assert "iot.rectronx.com" in content
        assert "Client adapter mode" in content
        assert "EthernetClient" in content
        assert "WiFiNINA" in content
        assert "SparkIoT.begin(networkClient" in content


def test_sparkiot_v1_release_contract_documents_supported_boards_and_protocol():
    manifest = (LIBRARY / "library.properties").read_text(encoding="utf-8")
    docs = (ROOT / "docs" / "arduino-library.md").read_text(encoding="utf-8")
    library_readme = (LIBRARY / "README.md").read_text(encoding="utf-8")

    assert "sentence=Official Spark IoT Arduino Library v1" in manifest
    for content in [docs, library_readme]:
        assert "SparkIoT Arduino Library v1.0.0" in content
        assert "ESP32" in content
        assert "ESP8266" in content
        assert "Arduino Uno R4 WiFi" in content
        assert "Arduino Ethernet" in content
        assert "spark/v1/{tenant_id}/{device_id}/telemetry/{channel}" in content
        assert "spark/v1/{tenant_id}/{device_id}/command/{channel}" in content
        assert "spark/v1/{tenant_id}/{device_id}/ack/{channel}" in content
        assert "Install from ZIP" in content


def test_sparkiot_library_ships_beginner_friendly_examples():
    examples = {
        "ESP32_Smart_Irrigation/ESP32_Smart_Irrigation.ino": ["#include <SparkIoT.h>", "SparkIoT.virtualWrite(\"V0\"", "SparkIoT.onCommand(\"V3\"", "SparkIoT.ack(\"V3\""],
        "ESP8266_Home_Relay/ESP8266_Home_Relay.ino": ["#include <SparkIoT.h>", "SparkIoT.virtualWrite(\"V1\"", "SparkIoT.onCommand(\"V0\""],
        "GPS_Tracker/GPS_Tracker.ino": ["#include <SparkIoT.h>", "SparkIoT.setLocation(\"V0\""],
        "Camera_URL/Camera_URL.ino": ["#include <SparkIoT.h>", "SparkIoT.setCameraUrl(\"V0\""],
        "Generic_Client_Adapter/Generic_Client_Adapter.ino": ["#include <SparkIoT.h>", "EthernetClient networkClient", "SparkIoT.begin(networkClient", "SparkIoT.virtualWrite(\"V0\""],
    }

    for relative_path, expected_snippets in examples.items():
        content = (LIBRARY / "examples" / relative_path).read_text(encoding="utf-8")
        for snippet in expected_snippets:
            assert snippet in content
