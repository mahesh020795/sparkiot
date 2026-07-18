"""Package the SparkIoT Arduino IDE library as an installable ZIP.

Usage:
    python scripts/package_arduino_library.py

Output:
    outputs/SparkIoT-Arduino-Library-v1.0.0.zip

Source:
    arduino/SparkIoT
"""

from __future__ import annotations

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
LIBRARY_DIR = ROOT / "arduino" / "SparkIoT"
OUTPUT_DIR = ROOT / "outputs"
OUTPUT_ZIP = OUTPUT_DIR / "SparkIoT-Arduino-Library-v1.0.0.zip"

REQUIRED_FILES = [
    "library.properties",
    "keywords.txt",
    "README.md",
    "src/SparkIoT.h",
    "src/SparkIoT.cpp",
]

EXCLUDED_PARTS = {
    ".DS_Store",
    "__pycache__",
    ".pytest_cache",
}


def assert_package_shape() -> None:
    missing = [relative for relative in REQUIRED_FILES if not (LIBRARY_DIR / relative).exists()]
    if missing:
        missing_list = ", ".join(missing)
        raise SystemExit(f"SparkIoT Arduino library package is incomplete. Missing: {missing_list}")


def should_include(path: Path) -> bool:
    return not any(part in EXCLUDED_PARTS for part in path.parts)


def main() -> None:
    assert_package_shape()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with ZipFile(OUTPUT_ZIP, "w", ZIP_DEFLATED) as archive:
        for path in sorted(LIBRARY_DIR.rglob("*")):
            if not path.is_file() or not should_include(path):
                continue

            archive_name = Path("SparkIoT") / path.relative_to(LIBRARY_DIR)
            archive.write(path, archive_name.as_posix())

    print(f"Created {OUTPUT_ZIP}")
    print(f"Size: {OUTPUT_ZIP.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
