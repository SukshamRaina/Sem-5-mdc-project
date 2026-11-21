"""
Unified Preprocessor for NASA C-MAPSS Engine Degradation Datasets (FD001–FD004).
Supports:
- Single-condition datasets (FD001, FD003) with zero-variance channel filtering.
- Multi-condition datasets (FD002, FD004) with operating-condition clustering and regime-aware normalization.
- Strict train-only fitting with zero data leakage (Rule 6).
- RUL target calculation with configurable piecewise linear clipping.
- Dataset-specific artifact serialization and backward-compatible loading.
"""

import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union
import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
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

# Informative sensor channels for FD001 (excluding 10 constant/near-zero variance channels)
DEFAULT_FEATURE_COLUMNS_FD001 = [
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

# Informative channels for FD003 (sensor_10 has variation; settings are sea-level constant)
DEFAULT_FEATURE_COLUMNS_FD003 = [
    "sensor_2",
    "sensor_3",
    "sensor_4",
    "sensor_7",
    "sensor_8",
    "sensor_9",
    "sensor_10",
    "sensor_11",
    "sensor_12",
    "sensor_13",
    "sensor_14",
    "sensor_15",
    "sensor_17",
    "sensor_20",
    "sensor_21",
]

# For multi-condition datasets (FD002 & FD004), operating settings + informative sensors
DEFAULT_FEATURE_COLUMNS_FD002 = [
    "setting_1",
    "setting_2",
    "setting_3",
    "sensor_2",
    "sensor_3",
    "sensor_4",
    "sensor_6",
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

DEFAULT_FEATURE_COLUMNS_FD004 = [
    "setting_1",
    "setting_2",
    "setting_3",
    "sensor_2",
    "sensor_3",
    "sensor_4",
    "sensor_6",
    "sensor_7",
    "sensor_8",
    "sensor_9",
    "sensor_10",
    "sensor_11",
    "sensor_12",
    "sensor_13",
    "sensor_14",
    "sensor_15",
    "sensor_17",
    "sensor_20",
    "sensor_21",
]

DATASET_DEFAULT_FEATURES: Dict[str, List[str]] = {
    "FD001": list(DEFAULT_FEATURE_COLUMNS_FD001),
    "FD002": list(DEFAULT_FEATURE_COLUMNS_FD002),
    "FD003": list(DEFAULT_FEATURE_COLUMNS_FD003),
    "FD004": list(DEFAULT_FEATURE_COLUMNS_FD004),
}

# Alias for backward compatibility with existing tests
DEFAULT_FEATURE_COLUMNS = list(DEFAULT_FEATURE_COLUMNS_FD001)


class CMapssPreprocessor:
    """
    Handles feature validation, condition-aware clustering, variance filtering,
    and min-max normalization across all four C-MAPSS datasets.
    """

    def __init__(
        self,
        dataset: str = "FD001",
        feature_columns: Optional[List[str]] = None,
        feature_range: Tuple[float, float] = (0.0, 1.0),
        max_rul_clip: float = 125.0,
        use_condition_normalization: Optional[bool] = None,
        n_condition_clusters: int = 6,
    ):
        self.dataset = dataset.upper()
        if feature_columns is not None:
            self.feature_columns = list(feature_columns)
        else:
            self.feature_columns = list(DATASET_DEFAULT_FEATURES.get(self.dataset, DEFAULT_FEATURE_COLUMNS_FD001))

        self.feature_range = feature_range
        self.max_rul_clip = max_rul_clip
        self.n_condition_clusters = n_condition_clusters

        # Auto-enable condition normalization for multi-regime datasets (FD002, FD004)
        if use_condition_normalization is None:
            self.use_condition_normalization = self.dataset in ["FD002", "FD004"]
        else:
            self.use_condition_normalization = use_condition_normalization

        self.scaler = MinMaxScaler(feature_range=self.feature_range)
        self.kmeans: Optional[KMeans] = None
        self.regime_stats: Dict[int, Dict[str, Dict[str, float]]] = {}
        self.is_fitted = False

    def fit(self, df: pd.DataFrame) -> "CMapssPreprocessor":
        """
        Fits normalization parameters strictly on provided training engine records.
        Eliminates data leakage (Rule 6).
        """
        self.validate_data(df)

        work_df = df.copy()

        # Multi-condition operating regime clustering
        if self.use_condition_normalization:
            setting_cols = ["setting_1", "setting_2", "setting_3"]
            missing_settings = [c for c in setting_cols if c not in work_df.columns]
            if missing_settings:
                logger.warning(
                    "Condition normalization requested but missing settings %s. Falling back to global scaling.",
                    missing_settings,
                )
                self.use_condition_normalization = False
            else:
                os.environ["LOKY_MAX_CPU_COUNT"] = "4"
                self.kmeans = KMeans(
                    n_clusters=self.n_condition_clusters,
                    random_state=42,
                    n_init=10,
                )
                work_df["_regime"] = self.kmeans.fit_predict(work_df[setting_cols])

                # Compute per-regime mean and std for each sensor in feature_columns
                sensor_cols = [c for c in self.feature_columns if c.startswith("sensor_")]
                self.regime_stats = {}
                for regime_id in range(self.n_condition_clusters):
                    regime_subset = work_df[work_df["_regime"] == regime_id]
                    stats = {}
                    for col in sensor_cols:
                        if len(regime_subset) > 0:
                            m = float(regime_subset[col].mean())
                            s = float(regime_subset[col].std())
                            stats[col] = {"mean": m, "std": s if s > 1e-6 else 1.0}
                        else:
                            stats[col] = {"mean": 0.0, "std": 1.0}
                    self.regime_stats[regime_id] = stats

                # Apply condition normalization to training dataframe before fitting MinMaxScaler
                work_df = self._apply_regime_normalization(work_df)

        self.scaler.fit(work_df[self.feature_columns])
        self.is_fitted = True
        logger.info(
            "[%s] Preprocessor fitted on %d records across %d features (ConditionNorm=%s)",
            self.dataset,
            len(df),
            len(self.feature_columns),
            self.use_condition_normalization,
        )
        return self

    def _apply_regime_normalization(self, df: pd.DataFrame) -> pd.DataFrame:
        """Normalizes sensor channels relative to their operating condition cluster statistics."""
        if not self.use_condition_normalization or self.kmeans is None:
            return df

        result = df.copy()
        setting_cols = ["setting_1", "setting_2", "setting_3"]
        if not all(c in result.columns for c in setting_cols):
            return result

        regimes = self.kmeans.predict(result[setting_cols])
        result["_regime"] = regimes

        sensor_cols = [c for c in self.feature_columns if c.startswith("sensor_")]
        for col in sensor_cols:
            if col in result.columns:
                result[col] = result[col].astype(np.float64)
        for regime_id, stats in self.regime_stats.items():
            mask = result["_regime"] == regime_id
            if mask.any():
                for col in sensor_cols:
                    if col in stats:
                        m = stats[col]["mean"]
                        s = stats[col]["std"]
                        result.loc[mask, col] = (result.loc[mask, col] - m) / s

        result.drop(columns=["_regime"], inplace=True, errors="ignore")
        return result

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Transforms input dataframe using fitted scaler and regime parameters,
        preserving unit numbers, cycle numbers, and metadata columns.
        """
        if not self.is_fitted:
            raise RuntimeError("Preprocessor must be fitted or loaded before calling transform().")

        self.validate_data(df)
        work_df = df.copy()

        if self.use_condition_normalization:
            work_df = self._apply_regime_normalization(work_df)

        scaled_values = self.scaler.transform(work_df[self.feature_columns])
        result_df = df.copy()
        result_df[self.feature_columns] = scaled_values
        return result_df

    def fit_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Fits on training data and returns transformed dataframe."""
        return self.fit(df).transform(df)

    def validate_data(self, df: pd.DataFrame) -> None:
        """
        Validates column presence, type compatibility, and absence of infinite / invalid values.
        """
        if df.empty:
            raise ValueError("Input dataframe is empty.")

        missing = [col for col in self.feature_columns if col not in df.columns]
        if missing:
            raise ValueError(
                f"Missing required sensor columns in input dataframe: {missing}. "
                f"Expected columns: {self.feature_columns}"
            )

        # Check for non-numeric and NaN values across required columns
        for col in self.feature_columns:
            if not pd.api.types.is_numeric_dtype(df[col]):
                coerced = pd.to_numeric(df[col], errors="coerce")
                if coerced.isna().any():
                    raise ValueError(f"Column '{col}' contains non-numeric values.")

            if df[col].isna().any():
                raise ValueError(f"Column '{col}' contains NaN values.")

            # Validate finite values (no inf / -inf)
            inf_mask = ~np.isfinite(df[col].values)
            if inf_mask.any():
                raise ValueError(
                    f"Column '{col}' contains infinite (inf / -inf) values. "
                    "All telemetry values must be finite numbers."
                )

    def attach_rul_labels(self, df: pd.DataFrame, clip_upper: bool = True) -> pd.DataFrame:
        """
        Computes Remaining Useful Life (RUL) for run-to-failure engine trajectories.
        Formula: RUL = max_cycle_for_engine - current_cycle
        Clips to max_rul_clip (125.0) to model the healthy degradation plateau.
        """
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

    def save(self, artifact_path: Union[Path, str]) -> None:
        """Serializes fitted preprocessor bundle including scaler, KMeans, and regime metadata."""
        if not self.is_fitted:
            raise RuntimeError("Cannot save unfitted preprocessor.")

        artifact_path = Path(artifact_path)
        artifact_path.parent.mkdir(parents=True, exist_ok=True)

        bundle = {
            "dataset": self.dataset,
            "feature_columns": self.feature_columns,
            "feature_range": self.feature_range,
            "max_rul_clip": self.max_rul_clip,
            "use_condition_normalization": self.use_condition_normalization,
            "n_condition_clusters": self.n_condition_clusters,
            "scaler": self.scaler,
            "kmeans": self.kmeans,
            "regime_stats": self.regime_stats,
            "min_vals": self.scaler.data_min_.tolist() if hasattr(self.scaler, "data_min_") else [],
            "max_vals": self.scaler.data_max_.tolist() if hasattr(self.scaler, "data_max_") else [],
        }
        joblib.dump(bundle, artifact_path)
        logger.info("Saved preprocessor bundle for %s to %s", self.dataset, artifact_path)

    @classmethod
    def load(cls, artifact_path: Union[Path, str]) -> "CMapssPreprocessor":
        """Loads fitted preprocessor from serialized joblib artifact with backward compatibility."""
        artifact_path = Path(artifact_path)
        if not artifact_path.exists():
            raise FileNotFoundError(f"Preprocessor artifact not found at {artifact_path}")

        bundle = joblib.load(artifact_path)
        instance = cls(
            dataset=bundle.get("dataset", "FD001"),
            feature_columns=bundle["feature_columns"],
            feature_range=bundle.get("feature_range", (0.0, 1.0)),
            max_rul_clip=bundle.get("max_rul_clip", 125.0),
            use_condition_normalization=bundle.get("use_condition_normalization", False),
            n_condition_clusters=bundle.get("n_condition_clusters", 6),
        )
        instance.scaler = bundle["scaler"]
        instance.kmeans = bundle.get("kmeans")
        instance.regime_stats = bundle.get("regime_stats", {})
        instance.is_fitted = True
        logger.info("Loaded preprocessor artifact for %s from %s", instance.dataset, artifact_path)
        return instance
