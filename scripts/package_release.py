from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import os


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = Path(os.environ.get("SPARK_IOT_OUTPUT_DIR", ROOT / "outputs"))
OUTPUT = OUTPUT_DIR / "Spark-IoT-MVP.zip"
EXCLUDED_PARTS = {
    ".git",
    ".superpowers",
    "node_modules",
    "dist",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    ".mypy_cache",
    ".venv",
    "outputs",
}
EXCLUDED_NAMES = {".env", "spark_iot.db"}
EXCLUDED_SUFFIXES = {".pyc", ".log"}


def should_include(path: Path) -> bool:
    rel = path.relative_to(ROOT)
    if any(part in EXCLUDED_PARTS for part in rel.parts):
        return False
    if path.name in EXCLUDED_NAMES:
        return False
    return path.suffix not in EXCLUDED_SUFFIXES


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if OUTPUT.exists():
        OUTPUT.unlink()
    with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as archive:
        for path in ROOT.rglob("*"):
            if path.is_file() and should_include(path):
                archive.write(path, path.relative_to(ROOT).as_posix())
    print(f"Created {OUTPUT}")
    print(f"Size: {OUTPUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
