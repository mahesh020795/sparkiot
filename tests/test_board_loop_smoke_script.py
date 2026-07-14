from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "board_loop_smoke.py"
BOARD_DOCS = ROOT / "docs" / "board-testing.md"


def test_board_loop_smoke_script_exists_and_documents_full_loop():
    assert SCRIPT.exists()

    content = SCRIPT.read_text(encoding="utf-8")
    for expected in [
        "telemetry/V0",
        "/demo/devices/{device_id}/commands",
        "ack/V3",
        "/demo/devices/{device_id}/command-logs",
        "mosquitto_pub",
        "Spark IoT board loop smoke",
    ]:
        assert expected in content


def test_board_testing_docs_explain_one_command_smoke_path():
    docs = BOARD_DOCS.read_text(encoding="utf-8")

    for expected in [
        "One-command board loop smoke test",
        "python scripts/board_loop_smoke.py",
        "telemetry -> command -> ACK -> command log",
        "--api-base http://34.73.29.12:8000/api/v1",
    ]:
        assert expected in docs
