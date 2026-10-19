"""
Ingestion script for NASA C-MAPSS Turbofan Engine Degradation Simulation Dataset (FD001).
Copies raw files from the source archive to backend/data/raw/ and validates integrity.
"""

import os
import shutil
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

RAW_COLUMNS = [
    "unit_number",
    "time_cycles",
    "setting_1",
    "setting_2",
    "setting_3",
] + [f"sensor_{i}" for i in range(1, 22)]

REQUIRED_FILES = [
    "train_FD001.txt",
    "test_FD001.txt",
    "RUL_FD001.txt",
]

DEFAULT_SOURCE_DIRS = [
    Path(r"D:\MDC predict ai\archive"),
    Path(r"D:\MDC predict ai"),
    Path("./data/source"),
]


def ingest_dataset(source_dir: Path | None = None, dest_dir: Path | None = None) -> Path:
    """Finds NASA C-MAPSS FD001 files, copies them to destination, and validates integrity."""
    if dest_dir is None:
        dest_dir = Path(__file__).resolve().parent.parent / "data" / "raw"
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Resolve source directory
    resolved_source: Path | None = None
    if source_dir and source_dir.exists():
        resolved_source = source_dir
    else:
        for candidate in DEFAULT_SOURCE_DIRS:
            if candidate.exists() and all((candidate / f).exists() for f in REQUIRED_FILES):
                resolved_source = candidate
                break

    if not resolved_source:
        # Check if already present in dest_dir
        if all((dest_dir / f).exists() for f in REQUIRED_FILES):
            logger.info("Files already present in destination directory: %s", dest_dir)
            resolved_source = dest_dir
        else:
            raise FileNotFoundError(
                f"Could not locate C-MAPSS dataset. Checked candidates: {DEFAULT_SOURCE_DIRS} and {dest_dir}"
            )

    # Copy files if source is different from destination
    if resolved_source.resolve() != dest_dir.resolve():
        logger.info("Copying C-MAPSS dataset from %s to %s", resolved_source, dest_dir)
        for fname in REQUIRED_FILES:
            src_file = resolved_source / fname
            dst_file = dest_dir / fname
            shutil.copy2(src_file, dst_file)
            logger.info("Copied: %s -> %s (%d bytes)", fname, dst_file, dst_file.stat().st_size)

        # Copy readme if present
        readme = resolved_source / "readme.txt"
        if readme.exists():
            shutil.copy2(readme, dest_dir / "readme.txt")

    # Validate integrity
    validate_raw_data(dest_dir)
    return dest_dir


def validate_raw_data(data_dir: Path) -> dict:
    """Validates line counts, column counts, and basic structure of FD001 data."""
    import pandas as pd

    train_path = data_dir / "train_FD001.txt"
    test_path = data_dir / "test_FD001.txt"
    rul_path = data_dir / "RUL_FD001.txt"

    train_df = pd.read_csv(train_path, sep=r"\s+", header=None, names=RAW_COLUMNS)
    test_df = pd.read_csv(test_path, sep=r"\s+", header=None, names=RAW_COLUMNS)
    rul_df = pd.read_csv(rul_path, sep=r"\s+", header=None, names=["rul"])

    summary = {
        "train_rows": len(train_df),
        "train_engines": train_df["unit_number"].nunique(),
        "train_columns": train_df.shape[1],
        "test_rows": len(test_df),
        "test_engines": test_df["unit_number"].nunique(),
        "rul_records": len(rul_df),
    }

    assert summary["train_engines"] == 100, f"Expected 100 train engines, got {summary['train_engines']}"
    assert summary["test_engines"] == 100, f"Expected 100 test engines, got {summary['test_engines']}"
    assert summary["rul_records"] == 100, f"Expected 100 ground truth RUL values, got {summary['rul_records']}"
    assert summary["train_columns"] == 26, f"Expected 26 columns, got {summary['train_columns']}"

    logger.info("C-MAPSS FD001 integrity verified: %s", summary)
    return summary


if __name__ == "__main__":
    ingest_dataset()
