"""
Inference Predictor Engine for NASA C-MAPSS Turbofan Predictive Maintenance.
Loads dataset-specific Physics-Informed Neural Network (PINN) artifacts (FD001–FD004)
and preprocessors to generate real-time Remaining Useful Life (RUL) and latent degradation states.
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras

from backend.app.core.config import settings
from .explainer import ModelExplainer
from .preprocessor import CMapssPreprocessor
from .risk import determine_risk_category, generate_maintenance_recommendation
from .sequence import create_sequences, create_test_last_sequences

logger = logging.getLogger(__name__)

SUPPORTED_DATASETS = ["FD001", "FD002", "FD003", "FD004"]


class CMapssPredictor:
    """
    Production inference wrapper supporting dataset-specific PINN models (FD001–FD004).
    Manages in-memory model caching, feature preprocessing, analytical gradient explainability,
    and latent physics degradation tracking.
    """

    def __init__(
        self,
        artifacts_dir: Optional[Union[Path, str]] = None,
        default_dataset: str = "FD001",
    ):
        if artifacts_dir is None:
            artifacts_dir = settings.PINN_ARTIFACTS_DIR
        self.artifacts_dir = Path(artifacts_dir)
        self.default_dataset = default_dataset.upper()
        self.active_dataset = self.default_dataset
        self.sequence_length = settings.SEQUENCE_LENGTH

        # Multi-dataset cache: dataset -> artifact instance
        self._models: Dict[str, keras.Model] = {}
        self._preprocessors: Dict[str, CMapssPreprocessor] = {}
        self._explainers: Dict[str, ModelExplainer] = {}
        self._features: Dict[str, List[str]] = {}

        # Default pointers for backward compatibility
        self.preprocessor: Optional[CMapssPreprocessor] = None
        self.model: Optional[keras.Model] = None
        self.explainer: Optional[ModelExplainer] = None
        self.feature_columns: List[str] = []
        self._is_loaded = False

    def load(self, dataset: Optional[str] = None) -> "CMapssPredictor":
        """
        Loads the trained PINN model and preprocessor for the specified dataset.
        Never silently falls back to legacy LSTM when a PINN artifact is missing.
        """
        ds = (dataset or self.default_dataset).upper()
        if ds not in SUPPORTED_DATASETS:
            raise ValueError(f"Unknown dataset '{ds}'. Supported datasets: {SUPPORTED_DATASETS}")

        # Check cache
        if ds in self._models and ds in self._preprocessors:
            self._set_active_pointers(ds)
            return self

        dataset_dir = self.artifacts_dir / ds
        model_path = dataset_dir / "pinn_model.keras"
        scaler_path = dataset_dir / "scaler.joblib"
        feature_path = dataset_dir / "feature_columns.json"

        # Explicit check — do not silently fall back to legacy LSTM
        if not model_path.exists():
            raise FileNotFoundError(
                f"Trained PINN model artifact for dataset '{ds}' was not found at {model_path}. "
                f"Train the model using: python -m backend.ml_pipeline.train_pinn --dataset {ds}"
            )
        if not scaler_path.exists():
            raise FileNotFoundError(
                f"Scaler artifact for dataset '{ds}' was not found at {scaler_path}. "
                f"Run training first: python -m backend.ml_pipeline.train_pinn --dataset {ds}"
            )

        # Load preprocessor
        preproc = CMapssPreprocessor.load(scaler_path)
        self._preprocessors[ds] = preproc

        # Load model
        model = keras.models.load_model(model_path, compile=False)
        self._models[ds] = model

        # Feature columns
        if feature_path.exists():
            with open(feature_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
                features = meta.get("selected_features", preproc.feature_columns)
        else:
            features = preproc.feature_columns
        self._features[ds] = features

        # Explainer
        self._explainers[ds] = ModelExplainer(model, features)

        self._set_active_pointers(ds)
        self._is_loaded = True
        logger.info(
            "CMapssPredictor loaded PINN model for [%s] with %d features.",
            ds,
            len(features),
        )
        return self

    def _set_active_pointers(self, ds: str) -> None:
        """Sets active default references for legacy compatibility."""
        self.active_dataset = ds
        self.model = self._models[ds]
        self.preprocessor = self._preprocessors[ds]
        self.explainer = self._explainers[ds]
        self.feature_columns = self._features[ds]
        self._is_loaded = True

    def get_or_load(self, dataset: Optional[str] = None) -> Tuple[keras.Model, CMapssPreprocessor, ModelExplainer, List[str]]:
        """Retrieves or loads the model, preprocessor, explainer, and features for a dataset."""
        ds = (dataset or self.active_dataset or self.default_dataset).upper()
        if ds not in self._models or ds not in self._preprocessors:
            self.load(ds)
        return self._models[ds], self._preprocessors[ds], self._explainers[ds], self._features[ds]

    def predict_engine(
        self,
        engine_df: pd.DataFrame,
        dataset: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Accepts a dataframe of an engine's cycle observations, performs condition-aware
        scaling, extracts the sliding window sequence, and evaluates the PINN.
        """
        ds = (dataset or self.active_dataset or self.default_dataset).upper()
        model, preprocessor, explainer, feature_cols = self.get_or_load(ds)

        # Sort by cycle
        df_sorted = engine_df.sort_values("time_cycles").copy()
        current_cycle = int(df_sorted["time_cycles"].iloc[-1])
        engine_id = int(df_sorted["unit_number"].iloc[-1]) if "unit_number" in df_sorted.columns else 1

        # Scale features
        scaled_df = preprocessor.transform(df_sorted)

        # Build sequence for latest state
        X_last, _, t_last = create_test_last_sequences(
            scaled_df,
            sequence_length=self.sequence_length,
            feature_columns=feature_cols,
            return_cycles=True,
        )

        num_cycles = len(df_sorted)
        is_padded = num_cycles < self.sequence_length

        # Run PINN dual-head inference
        t_norm = (t_last.reshape(-1, 1) / 100.0).astype(np.float32)
        outputs = model([X_last, t_norm], training=False)

        if isinstance(outputs, (list, tuple)):
            raw_rul = float(outputs[0].numpy().flatten()[0])
            raw_rate = float(outputs[1].numpy().flatten()[0])
        else:
            raw_rul = float(outputs.numpy().flatten()[0])
            raw_rate = 0.0

        predicted_rul = max(0.0, round(raw_rul, 1))
        degradation_rate = round(raw_rate, 4)
        latent_state = round(float(max(0.0, min(1.0, 1.0 - (predicted_rul / 125.0)))), 3)

        # Risk and maintenance recommendation policies
        risk = determine_risk_category(predicted_rul)

        explanation = None
        top_sensors = []
        if explainer is not None:
            explanation = explainer.generate_explanation(
                X_last,
                df_sorted,
                t_input=float(t_last[0] / 100.0),
            )
            top_sensors = [item["sensor"] for item in explanation.get("top_contributing_sensors", [])]

        recommendation_obj = generate_maintenance_recommendation(
            predicted_rul=predicted_rul,
            risk_level=risk["level"],
            engine_id=engine_id,
            current_cycle=current_cycle,
            top_contributing_sensors=top_sensors,
        )

        return {
            "dataset": ds,
            "model_type": "PINN",
            "model_version": f"pinn-{ds.lower()}-v1.0",
            "engine_id": engine_id,
            "current_cycle": current_cycle,
            "cycles_analyzed": num_cycles,
            "predicted_rul": predicted_rul,
            "latent_degradation_state": latent_state,
            "estimated_degradation_rate": degradation_rate,
            "risk_level": risk["level"],
            "risk_color": risk["color"],
            "recommendation": recommendation_obj["action"],
            "padded_sequence": is_padded,
            "sequence_length_used": self.sequence_length,
            "features_used": feature_cols,
            "priority": recommendation_obj["priority"],
            "risk_assessment": risk,
            "maintenance_recommendation": recommendation_obj,
            "explanation": explanation,
        }

    def predict_trajectory(
        self,
        engine_df: pd.DataFrame,
        dataset: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Generates cycle-by-cycle historical RUL and degradation predictions.
        """
        ds = (dataset or self.active_dataset or self.default_dataset).upper()
        model, preprocessor, _, feature_cols = self.get_or_load(ds)

        df_sorted = engine_df.sort_values("time_cycles").copy()
        scaled_df = preprocessor.transform(df_sorted)

        if len(df_sorted) < self.sequence_length:
            single = self.predict_engine(engine_df, dataset=ds)
            return [
                {
                    "cycle": int(df_sorted["time_cycles"].iloc[-1]),
                    "predicted_rul": single["predicted_rul"],
                    "risk_level": single["risk_level"],
                    "latent_degradation_state": single["latent_degradation_state"],
                    "estimated_degradation_rate": single["estimated_degradation_rate"],
                }
            ]

        seqs, _, _, cycles = create_sequences(
            scaled_df,
            sequence_length=self.sequence_length,
            feature_columns=feature_cols,
            target_column="unit_number",
            return_cycles=True,
        )

        if len(seqs) == 0:
            return []

        t_norm = (cycles.reshape(-1, 1) / 100.0).astype(np.float32)
        outputs = model([seqs, t_norm], training=False)
        if isinstance(outputs, (list, tuple)):
            rul_preds = outputs[0].numpy().flatten()
            rate_preds = outputs[1].numpy().flatten()
        else:
            rul_preds = outputs.numpy().flatten()
            rate_preds = np.zeros_like(rul_preds)

        trajectory = []
        for c, p, r in zip(cycles, rul_preds, rate_preds):
            rul_val = max(0.0, round(float(p), 1))
            rate_val = round(float(r), 4)
            deg_state = round(float(max(0.0, min(1.0, 1.0 - (rul_val / 125.0)))), 3)
            trajectory.append(
                {
                    "cycle": int(c),
                    "predicted_rul": rul_val,
                    "risk_level": determine_risk_category(rul_val)["level"],
                    "latent_degradation_state": deg_state,
                    "estimated_degradation_rate": rate_val,
                }
            )

        return trajectory
