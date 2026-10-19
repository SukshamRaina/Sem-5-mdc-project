"""
Baseline Machine Learning Model for C-MAPSS FD001 RUL Prediction.
Uses Random Forest Regressor trained on engine-aware split data to establish
a rigorous tabular benchmark against which the LSTM deep learning model is evaluated.
"""

import json
import logging
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from backend.app.ml.preprocessor import CMapssPreprocessor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

RAW_COLUMNS = [
    "unit_number",
    "time_cycles",
    "setting_1",
    "setting_2",
    "setting_3",
] + [f"sensor_{i}" for i in range(1, 22)]


def train_baseline_model(
    data_dir: Path | None = None,
    artifacts_dir: Path | None = None,
    train_val_split_ratio: float = 0.8,
    random_state: int = 42,
) -> dict:
    """Trains and benchmarks Random Forest Regressor baseline on C-MAPSS FD001."""
    base_dir = Path(__file__).resolve().parent.parent
    if data_dir is None:
        data_dir = base_dir / "data" / "raw"
    if artifacts_dir is None:
        artifacts_dir = base_dir / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    # 1. Load raw data
    train_df = pd.read_csv(data_dir / "train_FD001.txt", sep=r"\s+", header=None, names=RAW_COLUMNS)
    test_df = pd.read_csv(data_dir / "test_FD001.txt", sep=r"\s+", header=None, names=RAW_COLUMNS)
    rul_df = pd.read_csv(data_dir / "RUL_FD001.txt", sep=r"\s+", header=None, names=["rul"])

    # 2. Engine-aware train/val partition (Rule 7)
    engine_ids = np.sort(train_df["unit_number"].unique())
    np.random.seed(random_state)
    shuffled_engines = np.random.permutation(engine_ids)
    split_idx = int(len(shuffled_engines) * train_val_split_ratio)
    train_engines = shuffled_engines[:split_idx]
    val_engines = shuffled_engines[split_idx:]

    logger.info("Engine partition: %d train engines, %d val engines", len(train_engines), len(val_engines))

    train_subset = train_df[train_df["unit_number"].isin(train_engines)].copy()
    val_subset = train_df[train_df["unit_number"].isin(val_engines)].copy()

    # 3. Preprocessor (Rule 5 & Rule 6: fitted strictly on train_subset)
    preprocessor = CMapssPreprocessor(max_rul_clip=125.0)
    train_labeled = preprocessor.attach_rul_labels(train_subset, clip_upper=True)
    val_labeled = preprocessor.attach_rul_labels(val_subset, clip_upper=True)

    preprocessor.fit(train_labeled)
    train_scaled = preprocessor.transform(train_labeled)
    val_scaled = preprocessor.transform(val_labeled)

    feature_cols = preprocessor.feature_columns

    X_train = train_scaled[feature_cols].values
    y_train = train_scaled["rul_clipped"].values

    X_val = val_scaled[feature_cols].values
    y_val = val_scaled["rul_clipped"].values

    # 4. Train Random Forest Regressor
    logger.info("Training Random Forest Regressor baseline...")
    rf = RandomForestRegressor(
        n_estimators=100,
        max_depth=15,
        min_samples_split=5,
        n_jobs=-1,
        random_state=random_state,
    )
    rf.fit(X_train, y_train)

    # 5. Evaluate on Validation Set
    val_preds = rf.predict(X_val)
    val_rmse = float(np.sqrt(mean_squared_error(y_val, val_preds)))
    val_mae = float(mean_absolute_error(y_val, val_preds))
    val_r2 = float(r2_score(y_val, val_preds))
    logger.info("Validation Results -> RMSE: %.2f | MAE: %.2f | R²: %.4f", val_rmse, val_mae, val_r2)

    # 6. Evaluate on Held-Out Test Set (last cycle for each engine)
    test_scaled = preprocessor.transform(test_df)
    test_last_records = test_scaled.groupby("unit_number").last().reset_index()
    X_test_last = test_last_records[feature_cols].values
    y_test_true = rul_df["rul"].values

    test_preds = rf.predict(X_test_last)
    test_rmse = float(np.sqrt(mean_squared_error(y_test_true, test_preds)))
    test_mae = float(mean_absolute_error(y_test_true, test_preds))

    # NASA PHM 2008 scoring function:
    # d = y_pred - y_true
    # S = sum(exp(-d/13)-1 for d<0) + sum(exp(d/10)-1 for d>=0)
    d = test_preds - y_test_true
    nasa_score = float(np.sum(np.where(d < 0, np.exp(-d / 13.0) - 1.0, np.exp(d / 10.0) - 1.0)))

    logger.info("Test Results (Last Cycle) -> RMSE: %.2f | MAE: %.2f | NASA Score: %.2f", test_rmse, test_mae, nasa_score)

    # 7. Save Model & Summary
    model_save_path = artifacts_dir / "baseline_model.joblib"
    joblib.dump(
        {
            "model": rf,
            "feature_columns": feature_cols,
            "val_metrics": {"rmse": val_rmse, "mae": val_mae, "r2": val_r2},
            "test_metrics": {"rmse": test_rmse, "mae": test_mae, "nasa_score": nasa_score},
        },
        model_save_path,
    )

    metrics = {
        "model_type": "RandomForestRegressor (Baseline)",
        "train_samples": len(X_train),
        "val_samples": len(X_val),
        "test_engines": len(y_test_true),
        "validation_rmse": round(val_rmse, 3),
        "validation_mae": round(val_mae, 3),
        "test_rmse": round(test_rmse, 3),
        "test_mae": round(test_mae, 3),
        "test_nasa_score": round(nasa_score, 2),
    }

    with open(artifacts_dir / "baseline_metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    logger.info("Baseline training complete. Artifacts saved in %s", artifacts_dir)
    return metrics


if __name__ == "__main__":
    train_baseline_model()
