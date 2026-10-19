"""
Unified Preprocessor for NASA C-MAPSS Engine Degradation Data.
Used identically during model training and Phase 2/3 online inference (Rule 5).
Fitted exclusively on training engine units to eliminate data leakage (Rule 6).
"""

import json
import logging
from pathlib import Path
from typing import List, Tuple
import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

logger = logging.getLogger(__name__)

# Canonical raw 26 column schema for NASA C-MAPSS
RAW_COLUMNS = [
    "unit_number",
    "time_cycles",
    "setting_1",
    "setting_2",
    "setting_3",
] + [f"sensor_{i}" for i in range(1, 22)]

# Statistically vetted informative sensor features for FD001 (excluding flat zero-variance sensors)
DEFAULT_FEATURE_COLUMNS = [
    "sensor_2",
    "sensor_3",
    "sensor_4",
    "sensor_7",
    "sensor_8",
    "sensor_9",
    "sensor_11",
    "sensor_12",
    "sensor_13",
    "sensor_14",
    "sensor_15",
    "sensor_17",
    "sensor_20",
    "sensor_21",
]


class CMapssPreprocessor:
    """Handles feature validation, variance filtering, and min-max normalization."""

    def __init__(
        self,
        feature_columns: List[str] | None = None,
        feature_range: Tuple[float, float] = (0.0, 1.0),
        max_rul_clip: float = 125.0,
    ):
        self.feature_columns = feature_columns or list(DEFAULT_FEATURE_COLUMNS)
        self.feature_range = feature_range
        self.max_rul_clip = max_rul_clip
        self.scaler = MinMaxScaler(feature_range=self.feature_range)
        self.is_fitted = False

    def fit(self, df: pd.DataFrame) -> "CMapssPreprocessor":
        """Fits MinMaxScaler strictly on provided training engine records."""
        self.validate_columns(df)
        self.scaler.fit(df[self.feature_columns])
        self.is_fitted = True
        logger.info(
            "Preprocessor fitted on %d records across %d features",
            len(df),
            len(self.feature_columns),
        )
        return self

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Transforms input dataframe using fitted scaler, preserving index and metadata columns."""
        if not self.is_fitted:
            raise RuntimeError("Preprocessor must be fitted or loaded before calling transform().")

        self.validate_columns(df)
        result_df = df.copy()
        scaled_values = self.scaler.transform(df[self.feature_columns])
        result_df[self.feature_columns] = scaled_values
        return result_df

    def fit_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Fits on training data and returns transformed dataframe."""
        return self.fit(df).transform(df)

    def validate_columns(self, df: pd.DataFrame) -> None:
        """Validates that input dataframe has all required feature columns."""
        missing = [col for col in self.feature_columns if col not in df.columns]
        if missing:
            raise ValueError(
                f"Missing required sensor columns in input dataframe: {missing}. "
                f"Expected columns: {self.feature_columns}"
            )

    def attach_rul_labels(
        self, df: pd.DataFrame, clip_upper: bool = True
    ) -> pd.DataFrame:
        """Computes Remaining Useful Life (RUL) for run-to-failure engine trajectories."""
        result = df.copy()
        if "unit_number" not in result.columns or "time_cycles" not in result.columns:
            raise ValueError("Dataframe must contain 'unit_number' and 'time_cycles' to calculate RUL.")

        max_cycles = result.groupby("unit_number")["time_cycles"].transform("max")
        result["rul"] = max_cycles - result["time_cycles"]

        if clip_upper and self.max_rul_clip is not None:
            result["rul_clipped"] = result["rul"].clip(upper=self.max_rul_clip)
        else:
            result["rul_clipped"] = result["rul"]

        return result

    def save(self, artifact_path: Path | str) -> None:
        """Saves scaler and configuration metadata for deployment and backend inference."""
        if not self.is_fitted:
            raise RuntimeError("Cannot save unfitted preprocessor.")

        artifact_path = Path(artifact_path)
        artifact_path.parent.mkdir(parents=True, exist_ok=True)

        bundle = {
            "feature_columns": self.feature_columns,
            "feature_range": self.feature_range,
            "max_rul_clip": self.max_rul_clip,
            "scaler": self.scaler,
            "min_vals": self.scaler.data_min_.tolist(),
            "max_vals": self.scaler.data_max_.tolist(),
        }
        joblib.dump(bundle, artifact_path)
        logger.info("Saved preprocessor bundle to %s", artifact_path)

    @classmethod
    def load(cls, artifact_path: Path | str) -> "CMapssPreprocessor":
        """Loads fitted preprocessor from serialized joblib artifact."""
        artifact_path = Path(artifact_path)
        if not artifact_path.exists():
            raise FileNotFoundError(f"Preprocessor artifact not found at {artifact_path}")

        bundle = joblib.load(artifact_path)
        instance = cls(
            feature_columns=bundle["feature_columns"],
            feature_range=bundle["feature_range"],
            max_rul_clip=bundle.get("max_rul_clip", 125.0),
        )
        instance.scaler = bundle["scaler"]
        instance.is_fitted = True
        logger.info("Loaded preprocessor artifact from %s", artifact_path)
        return instance
