"""
Dataset Ingestion & Validation Pipeline for NASA C-MAPSS (FD001–FD004).
Discovers raw simulation files from archive/, copies them to backend/data/raw/,
and verifies integrity across all four operational subsets.
"""

import argparse
import logging
import os
from pathlib import Path
import shutil
from typing import Dict, List, Optional
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

RAW_COLUMNS = [
    "unit_number",
    "time_cycles",
    "setting_1",
    "setting_2",
    "setting_3",
] + [f"sensor_{i}" for i in range(1, 22)]

DATASET_CONFIGS = {
    "FD001": {
        "train_file": "train_FD001.txt",
        "test_file": "test_FD001.txt",
        "rul_file": "RUL_FD001.txt",
        "expected_train_engines": 100,
        "expected_test_engines": 100,
        "expected_rul_count": 100,
        "operating_conditions": 1,
        "fault_modes": 1,
        "description": "Sea Level, HPC Degradation",
    },
    "FD002": {
        "train_file": "train_FD002.txt",
        "test_file": "test_FD002.txt",
        "rul_file": "RUL_FD002.txt",
        "expected_train_engines": 260,
        "expected_test_engines": 259,
        "expected_rul_count": 259,
        "operating_conditions": 6,
        "fault_modes": 1,
        "description": "Six Regimes, HPC Degradation",
    },
    "FD003": {
        "train_file": "train_FD003.txt",
        "test_file": "test_FD003.txt",
        "rul_file": "RUL_FD003.txt",
        "expected_train_engines": 100,
        "expected_test_engines": 100,
        "expected_rul_count": 100,
        "operating_conditions": 1,
        "fault_modes": 2,
        "description": "Sea Level, HPC & Fan Degradation",
    },
    "FD004": {
        "train_file": "train_FD004.txt",
        "test_file": "test_FD004.txt",
        "rul_file": "RUL_FD004.txt",
        # Note: NASA's readme.txt had a typo transposing 248 and 249.
        # train_FD004 has 249 units; test_FD004 and RUL_FD004 have 248 units.
        "expected_train_engines": 249,
        "expected_test_engines": 248,
        "expected_rul_count": 248,
        "operating_conditions": 6,
        "fault_modes": 2,
        "description": "Six Regimes, HPC & Fan Degradation",
    },
}

SUPPORTED_DATASETS = list(DATASET_CONFIGS.keys())

DEFAULT_SOURCE_DIRS = [
    Path(__file__).resolve().parent.parent.parent / "archive",
    Path("./archive"),
    Path("../archive"),
    Path(r"D:\MDC predict ai\archive"),
    Path("./data/source"),
]


def find_source_directory(dataset: str, candidate_dirs: Optional[List[Path]] = None) -> Path:
    """Locates the source directory containing the required raw files for the given dataset."""
    dirs_to_check = candidate_dirs or DEFAULT_SOURCE_DIRS
    cfg = DATASET_CONFIGS[dataset]
    required = [cfg["train_file"], cfg["test_file"], cfg["rul_file"]]

    for cand in dirs_to_check:
        cand_path = Path(cand).resolve()
        if cand_path.exists() and all((cand_path / f).exists() for f in required):
            return cand_path

    raise FileNotFoundError(
        f"Could not locate C-MAPSS files for {dataset} (required: {required}). "
        f"Checked candidates: {[str(d) for d in dirs_to_check]}"
    )


def ingest_dataset(
    dataset: str = "FD001",
    source_dir: Optional[Path] = None,
    dest_dir: Optional[Path] = None,
) -> Path:
    """
    Ingests and validates a single C-MAPSS dataset (FD001, FD002, FD003, or FD004).
    Copies raw files from archive to destination and validates data integrity.
    """
    dataset = dataset.upper()
    if dataset not in DATASET_CONFIGS:
        raise ValueError(f"Unknown dataset '{dataset}'. Must be one of {SUPPORTED_DATASETS}")

    if dest_dir is None:
        dest_dir = Path(__file__).resolve().parent.parent / "data" / "raw"
    dest_dir = Path(dest_dir).resolve()
    dest_dir.mkdir(parents=True, exist_ok=True)

    cfg = DATASET_CONFIGS[dataset]
    required_files = [cfg["train_file"], cfg["test_file"], cfg["rul_file"]]

    # Check if files already exist in destination
    already_in_dest = all((dest_dir / f).exists() for f in required_files)

    if already_in_dest:
        logger.info("Files for %s already present in destination: %s", dataset, dest_dir)
    else:
        # Locate source
        resolved_src = source_dir if source_dir and source_dir.exists() else find_source_directory(dataset)
        logger.info("Copying %s dataset from %s to %s", dataset, resolved_src, dest_dir)
        for fname in required_files:
            src_file = resolved_src / fname
            dst_file = dest_dir / fname
            shutil.copy2(src_file, dst_file)
            logger.info("Copied: %s -> %s (%d bytes)", fname, dst_file, dst_file.stat().st_size)

        # Copy documentation if present
        readme = resolved_src / "readme.txt"
        if readme.exists():
            shutil.copy2(readme, dest_dir / "readme.txt")

    # Validate data integrity
    validate_dataset(dataset, dest_dir)
    return dest_dir


def validate_dataset(dataset: str, data_dir: Path) -> Dict[str, int]:
    """Validates row counts, engine counts, and column counts for a specific dataset."""
    cfg = DATASET_CONFIGS[dataset]
    train_path = data_dir / cfg["train_file"]
    test_path = data_dir / cfg["test_file"]
    rul_path = data_dir / cfg["rul_file"]

    if not train_path.exists() or not test_path.exists() or not rul_path.exists():
        raise FileNotFoundError(f"Missing required files for {dataset} in {data_dir}")

    train_df = pd.read_csv(train_path, sep=r"\s+", header=None, names=RAW_COLUMNS)
    test_df = pd.read_csv(test_path, sep=r"\s+", header=None, names=RAW_COLUMNS)
    rul_df = pd.read_csv(rul_path, sep=r"\s+", header=None, names=["rul"])

    summary = {
        "dataset": dataset,
        "train_rows": len(train_df),
        "train_engines": int(train_df["unit_number"].nunique()),
        "train_columns": int(train_df.shape[1]),
        "test_rows": len(test_df),
        "test_engines": int(test_df["unit_number"].nunique()),
        "test_columns": int(test_df.shape[1]),
        "rul_records": len(rul_df),
    }

    assert summary["train_columns"] == 26, f"Expected 26 train columns, got {summary['train_columns']}"
    assert summary["test_columns"] == 26, f"Expected 26 test columns, got {summary['test_columns']}"
    assert summary["train_engines"] == cfg["expected_train_engines"], (
        f"[{dataset}] Expected {cfg['expected_train_engines']} train engines, got {summary['train_engines']}"
    )
    assert summary["test_engines"] == cfg["expected_test_engines"], (
        f"[{dataset}] Expected {cfg['expected_test_engines']} test engines, got {summary['test_engines']}"
    )
    assert summary["rul_records"] == cfg["expected_rul_count"], (
        f"[{dataset}] Expected {cfg['expected_rul_count']} RUL records, got {summary['rul_records']}"
    )

    # Validate non-empty and non-negative
    assert not train_df.isna().any().any(), f"[{dataset}] Train dataframe contains NaN values"
    assert not test_df.isna().any().any(), f"[{dataset}] Test dataframe contains NaN values"
    assert not rul_df.isna().any().any(), f"[{dataset}] RUL dataframe contains NaN values"
    assert (rul_df["rul"] >= 0).all(), f"[{dataset}] Ground truth RUL contains negative values"

    logger.info("Dataset %s verified successfully: %s", dataset, summary)
    return summary


def ingest_all_datasets(dest_dir: Optional[Path] = None) -> Dict[str, Dict[str, int]]:
    """Ingests and validates all four C-MAPSS datasets (FD001, FD002, FD003, FD004)."""
    results = {}
    for ds in SUPPORTED_DATASETS:
        logger.info("=== Ingesting %s ===", ds)
        d = ingest_dataset(dataset=ds, dest_dir=dest_dir)
        results[ds] = {"dataset": ds, "status": "verified"}
    return results


def main():
    parser = argparse.ArgumentParser(description="Ingest NASA C-MAPSS turbofan engine datasets.")
    parser.add_argument(
        "--dataset",
        type=str,
        default="all",
        choices=["all", "FD001", "FD002", "FD003", "FD004", "fd001", "fd002", "fd003", "fd004"],
        help="Dataset to ingest ('all' or specific subset FD001-FD004)",
    )
    parser.add_argument(
        "--dest-dir",
        type=str,
        default=None,
        help="Destination directory (defaults to backend/data/raw/)",
    )
    args = parser.parse_args()

    dest = Path(args.dest_dir) if args.dest_dir else None
    if args.dataset.lower() == "all":
        ingest_all_datasets(dest_dir=dest)
    else:
        ingest_dataset(dataset=args.dataset.upper(), dest_dir=dest)


if __name__ == "__main__":
    main()
