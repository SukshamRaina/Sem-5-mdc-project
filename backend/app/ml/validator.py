"""
Input CSV Parsing and Data Validation for C-MAPSS Inference.
Ensures strict type compliance, checks for missing sensor channels,
orders cycles, and structures multi-engine data payloads.
"""

import io
import logging
from typing import Dict, List, Tuple
import numpy as np
import pandas as pd

from backend.app.ml.preprocessor import DEFAULT_FEATURE_COLUMNS, RAW_COLUMNS

logger = logging.getLogger(__name__)


def parse_and_validate_csv(
    content: str | bytes,
    required_features: List[str] | None = None,
    max_rows: int = 50_000,
) -> Dict[int, pd.DataFrame]:
    """
    Parses and thoroughly validates an uploaded CSV file.
    
    Supports:
    1. Standard CSV with header names (e.g. unit_number, time_cycles, sensor_1, ...)
    2. Comma, tab, or whitespace delimited files.
    3. Raw space-delimited NASA C-MAPSS format (26 columns without header).
    4. Single-engine or multi-engine datasets.
    
    Returns:
        Dict mapping engine_id -> sorted DataFrame containing validated numeric sensor readings.
    
    Raises:
        ValueError with informative diagnostics if validation fails.
    """
    if required_features is None:
        required_features = list(DEFAULT_FEATURE_COLUMNS)

    # 1. Decode bytes if needed
    if isinstance(content, bytes):
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            text = content.decode("latin-1")
    else:
        text = str(content)

    text = text.strip()
    if not text:
        raise ValueError("The uploaded CSV data is empty.")

    # 2. Parse into DataFrame
    try:
        # First attempt standard parse with delimiter inference
        sample_line = text.splitlines()[0]
        if "," in sample_line:
            sep = ","
        elif "\t" in sample_line:
            sep = "\t"
        else:
            sep = r"\s+"

        df = pd.read_csv(io.StringIO(text), sep=sep)
    except Exception as exc:
        raise ValueError(f"Unable to parse CSV structure: {str(exc)}") from exc

    if df.empty:
        raise ValueError("Uploaded CSV contains no data rows.")

    if len(df) > max_rows:
        raise ValueError(
            f"CSV contains {len(df):,} rows which exceeds the "
            f"{max_rows:,}-row limit. Split the dataset into smaller batches."
        )

    # 3. Handle raw NASA C-MAPSS format without headers (26 numeric columns)
    # If the first row was treated as header but consists of pure numbers:
    is_numeric_header = False
    try:
        float(df.columns[0])
        is_numeric_header = True
    except (ValueError, TypeError):
        pass

    if is_numeric_header or len(df.columns) == 26 and not any("sensor" in str(c).lower() for c in df.columns):
        # Re-read with explicit column names
        df = pd.read_csv(io.StringIO(text), sep=sep, header=None, names=RAW_COLUMNS)

    # Clean and normalize column names (lowercase, strip whitespace)
    df.columns = [str(col).strip().lower() for col in df.columns]

    # 4. Validate presence of required sensor features
    missing_sensors = [feat for feat in required_features if feat not in df.columns]
    if missing_sensors:
        available_cols = list(df.columns)[:15]
        raise ValueError(
            f"Missing {len(missing_sensors)} required sensor column(s): {missing_sensors}. "
            f"Available columns found: {available_cols}..."
        )

    # 5. Handle unit_number and time_cycles
    if "unit_number" not in df.columns:
        logger.info("Column 'unit_number' not found. Assigning default engine_id = 1.")
        df["unit_number"] = 1

    if "time_cycles" not in df.columns:
        logger.info("Column 'time_cycles' not found. Inferring sequential cycles starting at 1.")
        # Infer cycle index grouped by unit_number
        df["time_cycles"] = df.groupby("unit_number").cumcount() + 1

    # 6. Numeric validation across required columns
    columns_to_validate = ["unit_number", "time_cycles"] + required_features

    for col in columns_to_validate:
        # Check non-numeric strings
        non_numeric = pd.to_numeric(df[col], errors="coerce")
        nan_indices = non_numeric.isna()
        if nan_indices.any():
            bad_rows = df[nan_indices].index.tolist()[:5]
            bad_values = df.loc[bad_rows, col].tolist()
            raise ValueError(
                f"Column '{col}' contains non-numeric or NaN values {bad_values} at rows {bad_rows}."
            )
        df[col] = non_numeric

    # 6b. Reject infinite values (inf / -inf) that pass pd.to_numeric but corrupt LSTM inputs
    sensor_cols_to_check = [c for c in required_features if c in df.columns]
    inf_mask = ~np.isfinite(df[sensor_cols_to_check].values)
    if inf_mask.any():
        bad_col_idx = int(np.argwhere(inf_mask)[0][1])
        bad_col = sensor_cols_to_check[bad_col_idx]
        raise ValueError(
            f"Column '{bad_col}' contains infinite (inf/-inf) values. "
            "All sensor readings must be finite real numbers."
        )

    # 7. Cycle ordering & validity
    if (df["time_cycles"] <= 0).any():
        raise ValueError("Column 'time_cycles' must contain positive integers (> 0).")

    # Group by engine and sort by cycle
    engines_data: Dict[int, pd.DataFrame] = {}
    for unit, group in df.groupby("unit_number"):
        engine_id = int(unit)
        sorted_group = group.sort_values("time_cycles").reset_index(drop=True)

        # Check for duplicate cycles
        dupes = sorted_group[sorted_group.duplicated(subset=["time_cycles"], keep=False)]
        if not dupes.empty:
            dup_cycles = dupes["time_cycles"].unique().tolist()[:5]
            raise ValueError(
                f"Engine {engine_id} contains duplicate operational cycles: {dup_cycles}."
            )

        engines_data[engine_id] = sorted_group

    logger.info("Successfully validated CSV: %d engine(s) ready for inference.", len(engines_data))
    return engines_data
