"""
Inference Predictor Engine for NASA C-MAPSS FD001 Turbofan Predictive Maintenance.
Loads serialized scaler and Keras LSTM model artifacts to generate real-time RUL predictions.
Designed for direct integration with FastAPI endpoints in Phase 2.
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras

from .preprocessor import CMapssPreprocessor
from .sequence import create_sequences, create_test_last_sequences

logger = logging.getLogger(__name__)


def determine_risk_category(predicted_rul: float) -> Dict[str, str]:
    """
    Transparent rule-based risk classification based on predicted Remaining Useful Life:
    - CRITICAL (RUL <= 25 cycles): Immediate inspection and component replacement required.
    - WARNING  (25 < RUL <= 50 cycles): Schedule maintenance within the next 20 flight cycles.
    - MODERATE (50 < RUL <= 80 cycles): Increased sensor monitoring and trend inspection.
    - HEALTHY  (RUL > 80 cycles): Normal operational status.
    """
    if predicted_rul <= 25.0:
        return {
            "level": "CRITICAL",
            "color": "#e53e3e",
            "action": "Immediate inspection and component replacement required before next flight mission.",
        }
    elif predicted_rul <= 50.0:
        return {
            "level": "WARNING",
            "color": "#dd6b20",
            "action": "Schedule HPC inspection and overhaul within the next 20 flight cycles.",
        }
    elif predicted_rul <= 80.0:
        return {
            "level": "MODERATE",
            "color": "#d69e2e",
            "action": "Monitor sensor drift; flag for routine line maintenance check.",
        }
    else:
        return {
            "level": "HEALTHY",
            "color": "#38a169",
            "action": "Turbofan engine operating within nominal degradation tolerances.",
        }


class CMapssPredictor:
    """Production inference wrapper for C-MAPSS engine RUL prediction."""

    def __init__(self, artifacts_dir: Path | str | None = None):
        if artifacts_dir is None:
            artifacts_dir = Path(__file__).resolve().parent.parent.parent / "artifacts"
        self.artifacts_dir = Path(artifacts_dir)
        self.preprocessor: Optional[CMapssPreprocessor] = None
        self.model: Optional[keras.Model] = None
        self.feature_columns: List[str] = []
        self.sequence_length = 30
        self._is_loaded = False

    def load(self) -> "CMapssPredictor":
        """Loads fitted preprocessor and trained Keras LSTM model."""
        scaler_path = self.artifacts_dir / "scaler.joblib"
        model_path = self.artifacts_dir / "lstm_model.keras"
        feature_path = self.artifacts_dir / "feature_columns.json"

        if not scaler_path.exists():
            raise FileNotFoundError(f"Scaler artifact not found at {scaler_path}")
        if not model_path.exists():
            raise FileNotFoundError(f"Model artifact not found at {model_path}")

        self.preprocessor = CMapssPreprocessor.load(scaler_path)
        self.model = keras.models.load_model(model_path)

        if feature_path.exists():
            with open(feature_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
                self.feature_columns = meta.get("selected_features", self.preprocessor.feature_columns)
        else:
            self.feature_columns = self.preprocessor.feature_columns

        self._is_loaded = True
        logger.info(
            "CMapssPredictor loaded successfully with %d features.",
            len(self.feature_columns),
        )
        return self

    def predict_engine(self, engine_df: pd.DataFrame) -> Dict[str, Any]:
        """
        Accepts a dataframe of an engine's cycle observations, performs validation,
        scales features using the training scaler, extracts the sliding window,
        and computes the estimated Remaining Useful Life.
        """
        if not self._is_loaded:
            self.load()

        assert self.preprocessor is not None
        assert self.model is not None

        # Sort by cycle
        df_sorted = engine_df.sort_values("time_cycles").copy()
        current_cycle = int(df_sorted["time_cycles"].iloc[-1])
        engine_id = int(df_sorted["unit_number"].iloc[-1]) if "unit_number" in df_sorted.columns else 1

        # Scale features
        scaled_df = self.preprocessor.transform(df_sorted)

        # Build sequence for latest state
        X_last, _ = create_test_last_sequences(
            scaled_df, sequence_length=self.sequence_length, feature_columns=self.feature_columns
        )

        # Check if sequence is padded
        num_cycles = len(df_sorted)
        is_padded = num_cycles < self.sequence_length

        # Predict RUL
        raw_pred = float(self.model.predict(X_last, verbose=0).flatten()[0])
        predicted_rul = max(0.0, round(raw_pred, 1))

        risk = determine_risk_category(predicted_rul)

        return {
            "engine_id": engine_id,
            "current_cycle": current_cycle,
            "cycles_analyzed": num_cycles,
            "predicted_rul": predicted_rul,
            "risk_level": risk["level"],
            "risk_color": risk["color"],
            "recommendation": risk["action"],
            "padded_sequence": is_padded,
            "sequence_length_used": self.sequence_length,
            "features_used": self.feature_columns,
        }

    def predict_trajectory(self, engine_df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Generates cycle-by-cycle historical RUL predictions for an engine trajectory.
        Used for visualization in dashboard graphs.
        """
        if not self._is_loaded:
            self.load()

        assert self.preprocessor is not None
        assert self.model is not None

        df_sorted = engine_df.sort_values("time_cycles").copy()
        scaled_df = self.preprocessor.transform(df_sorted)

        if len(df_sorted) < self.sequence_length:
            # If fewer cycles than sequence length, provide current cycle prediction point
            single_pred = self.predict_engine(engine_df)
            return [
                {
                    "cycle": int(df_sorted["time_cycles"].iloc[-1]),
                    "predicted_rul": single_pred["predicted_rul"],
                    "risk_level": single_pred["risk_level"],
                }
            ]

        seqs, _, _ = create_sequences(
            scaled_df,
            sequence_length=self.sequence_length,
            feature_columns=self.feature_columns,
            target_column="unit_number",  # Dummy target
        )

        if len(seqs) == 0:
            return []

        preds = self.model.predict(seqs, verbose=0).flatten()
        cycles = df_sorted["time_cycles"].values[self.sequence_length - 1 :]

        trajectory = []
        for c, p in zip(cycles, preds):
            rul_val = max(0.0, round(float(p), 1))
            trajectory.append(
                {
                    "cycle": int(c),
                    "predicted_rul": rul_val,
                    "risk_level": determine_risk_category(rul_val)["level"],
                }
            )

        return trajectory

