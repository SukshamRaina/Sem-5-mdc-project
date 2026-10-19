"""
Model Evaluation and Benchmarking Suite for NASA C-MAPSS FD001.
Compares Stacked LSTM Regressor against Random Forest Baseline on the official held-out test engines.
Metrics computed:
- Root Mean Squared Error (RMSE)
- Mean Absolute Error (MAE)
- NASA PHM 2008 Asymmetric Scoring Function
- Correlation & R² coefficient
Generates parity plots, residual error distribution, and engine trajectory tracking.
"""

import json
import logging
from pathlib import Path
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import tensorflow as tf
from tensorflow import keras

from backend.app.ml.preprocessor import CMapssPreprocessor
from backend.app.ml.sequence import create_sequences, create_test_last_sequences

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

RAW_COLUMNS = [
    "unit_number",
    "time_cycles",
    "setting_1",
    "setting_2",
    "setting_3",
] + [f"sensor_{i}" for i in range(1, 22)]


def compute_nasa_phm_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """
    Computes the NASA PHM 2008 challenge asymmetric scoring metric.
    Penalizes late predictions (d < 0, where actual RUL < predicted) more heavily
    than conservative early predictions (d >= 0).
    """
    d = y_pred - y_true
    scores = np.where(d < 0, np.exp(-d / 13.0) - 1.0, np.exp(d / 10.0) - 1.0)
    return float(np.sum(scores))


def evaluate_models(
    data_dir: Path | None = None,
    artifacts_dir: Path | None = None,
    sequence_length: int = 30,
) -> dict:
    """Evaluates both Baseline and LSTM models on test_FD001.txt and RUL_FD001.txt."""
    base_dir = Path(__file__).resolve().parent.parent
    if data_dir is None:
        data_dir = base_dir / "data" / "raw"
    if artifacts_dir is None:
        artifacts_dir = base_dir / "artifacts"
    plots_dir = artifacts_dir / "plots"
    plots_dir.mkdir(parents=True, exist_ok=True)

    # 1. Load test data and true RUL
    test_df = pd.read_csv(data_dir / "test_FD001.txt", sep=r"\s+", header=None, names=RAW_COLUMNS)
    rul_df = pd.read_csv(data_dir / "RUL_FD001.txt", sep=r"\s+", header=None, names=["rul"])
    y_test_true = rul_df["rul"].values

    # 2. Load preprocessor and transform test data
    scaler_path = artifacts_dir / "scaler.joblib"
    if not scaler_path.exists():
        raise FileNotFoundError(f"Scaler not found at {scaler_path}. Run training first.")
    preprocessor = CMapssPreprocessor.load(scaler_path)
    test_scaled = preprocessor.transform(test_df)
    feature_cols = preprocessor.feature_columns

    # 3. Baseline Random Forest inference
    baseline_bundle_path = artifacts_dir / "baseline_model.joblib"
    baseline_bundle = joblib.load(baseline_bundle_path)
    rf_model = baseline_bundle["model"]

    test_last_records = test_scaled.groupby("unit_number").last().reset_index()
    X_test_baseline = test_last_records[feature_cols].values
    baseline_preds = rf_model.predict(X_test_baseline)

    # 4. LSTM Model inference
    lstm_path = artifacts_dir / "lstm_model.keras"
    if not lstm_path.exists():
        raise FileNotFoundError(f"LSTM model not found at {lstm_path}. Run train_lstm.py first.")
    lstm_model = keras.models.load_model(lstm_path)

    X_test_last, engine_ids = create_test_last_sequences(
        test_scaled, sequence_length=sequence_length, feature_columns=feature_cols
    )
    lstm_preds = lstm_model.predict(X_test_last, verbose=0).flatten()

    # 5. Compute metrics
    # Random Forest metrics
    rf_rmse = float(np.sqrt(mean_squared_error(y_test_true, baseline_preds)))
    rf_mae = float(mean_absolute_error(y_test_true, baseline_preds))
    rf_r2 = float(r2_score(y_test_true, baseline_preds))
    rf_score = compute_nasa_phm_score(y_test_true, baseline_preds)

    # LSTM metrics
    lstm_rmse = float(np.sqrt(mean_squared_error(y_test_true, lstm_preds)))
    lstm_mae = float(mean_absolute_error(y_test_true, lstm_preds))
    lstm_r2 = float(r2_score(y_test_true, lstm_preds))
    lstm_score = compute_nasa_phm_score(y_test_true, lstm_preds)

    logger.info("=== EVALUATION BENCHMARK ON 100 TEST ENGINES ===")
    logger.info("Baseline Random Forest -> RMSE: %.2f | MAE: %.2f | R²: %.4f | NASA Score: %.2f", rf_rmse, rf_mae, rf_r2, rf_score)
    logger.info("Deep Learning LSTM     -> RMSE: %.2f | MAE: %.2f | R²: %.4f | NASA Score: %.2f", lstm_rmse, lstm_mae, lstm_r2, lstm_score)

    # 6. Plot 1: Parity Plot (Actual vs Predicted RUL)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6), sharey=True)
    max_val = max(y_test_true.max(), baseline_preds.max(), lstm_preds.max()) + 10

    # Baseline Parity
    ax1.scatter(y_test_true, baseline_preds, alpha=0.75, color="#dd6b20", edgecolors="black", s=45, label="Test Engines")
    ax1.plot([0, max_val], [0, max_val], "k--", lw=1.8, label="Ideal Prediction (y = x)")
    ax1.fill_between([0, max_val], [0 - 15, max_val - 15], [0 + 15, max_val + 15], color="gray", alpha=0.15, label="±15 Cycles Tolerance")
    ax1.set_title(f"Baseline Random Forest (RMSE: {rf_rmse:.2f}, MAE: {rf_mae:.2f})", fontsize=11, fontweight="bold")
    ax1.set_xlabel("True Remaining Useful Life (Cycles)", fontsize=10)
    ax1.set_ylabel("Predicted RUL (Cycles)", fontsize=10)
    ax1.set_xlim(0, max_val)
    ax1.set_ylim(0, max_val)
    ax1.grid(True, linestyle="--", alpha=0.5)
    ax1.legend(loc="upper left")

    # LSTM Parity
    ax2.scatter(y_test_true, lstm_preds, alpha=0.85, color="#2b6cb0", edgecolors="black", s=45, label="Test Engines")
    ax2.plot([0, max_val], [0, max_val], "k--", lw=1.8, label="Ideal Prediction (y = x)")
    ax2.fill_between([0, max_val], [0 - 15, max_val - 15], [0 + 15, max_val + 15], color="#2b6cb0", alpha=0.15, label="±15 Cycles Tolerance")
    ax2.set_title(f"Stacked LSTM Regressor (RMSE: {lstm_rmse:.2f}, MAE: {lstm_mae:.2f})", fontsize=11, fontweight="bold")
    ax2.set_xlabel("True Remaining Useful Life (Cycles)", fontsize=10)
    ax2.set_xlim(0, max_val)
    ax2.set_ylim(0, max_val)
    ax2.grid(True, linestyle="--", alpha=0.5)
    ax2.legend(loc="upper left")

    plt.suptitle("Model Evaluation Parity Comparison (100 C-MAPSS FD001 Test Engines)", fontsize=13, fontweight="bold")
    plt.tight_layout()
    plt.savefig(plots_dir / "test_predictions_parity.png", dpi=300)
    plt.close()

    # 7. Plot 2: Trajectory degradation tracking for a sample test engine (e.g. Engine 24)
    sample_engine_id = 24
    sample_df = test_scaled[test_scaled["unit_number"] == sample_engine_id].copy()
    sample_true_final_rul = float(rul_df.iloc[sample_engine_id - 1]["rul"])

    # Build sequence at every cycle for sample engine to plot its historical trajectory
    sample_seqs, _, _ = create_sequences(
        sample_df, sequence_length=sequence_length, feature_columns=feature_cols, target_column="unit_number"
    )
    if len(sample_seqs) > 0:
        sample_preds = lstm_model.predict(sample_seqs, verbose=0).flatten()
        cycles_axis = sample_df["time_cycles"].values[sequence_length - 1 :]
        total_engine_life = sample_df["time_cycles"].max() + sample_true_final_rul
        ground_truth_trajectory = [total_engine_life - c for c in cycles_axis]

        plt.figure(figsize=(10, 5))
        plt.plot(cycles_axis, ground_truth_trajectory, color="black", lw=2, linestyle="--", label="Actual Degradation Trajectory")
        plt.plot(cycles_axis, sample_preds, color="#3182ce", lw=2.2, label="LSTM Predicted RUL")
        plt.title(f"Dynamic RUL Prediction Trajectory — Test Engine #{sample_engine_id}", fontsize=12, fontweight="bold")
        plt.xlabel("Operational Cycles Completed", fontsize=10)
        plt.ylabel("Estimated Remaining Useful Life (Cycles)", fontsize=10)
        plt.grid(True, linestyle="--", alpha=0.5)
        plt.legend()
        plt.tight_layout()
        plt.savefig(plots_dir / f"test_engine_{sample_engine_id}_trajectory.png", dpi=300)
        plt.close()

    # 8. Save comprehensive evaluation report
    report = {
        "dataset": "NASA C-MAPSS FD001",
        "num_test_engines": len(y_test_true),
        "sequence_length": sequence_length,
        "models": {
            "random_forest_baseline": {
                "rmse": round(rf_rmse, 3),
                "mae": round(rf_mae, 3),
                "r2_score": round(rf_r2, 4),
                "nasa_phm_score": round(rf_score, 2),
            },
            "stacked_lstm": {
                "rmse": round(lstm_rmse, 3),
                "mae": round(lstm_mae, 3),
                "r2_score": round(lstm_r2, 4),
                "nasa_phm_score": round(lstm_score, 2),
            },
        },
        "performance_gain": {
            "rmse_improvement_cycles": round(rf_rmse - lstm_rmse, 3),
            "mae_improvement_cycles": round(rf_mae - lstm_mae, 3),
            "nasa_score_reduction": round(rf_score - lstm_score, 2),
        },
    }

    with open(artifacts_dir / "evaluation_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    logger.info("Evaluation complete. Report and plots saved to %s", artifacts_dir)
    return report


if __name__ == "__main__":
    evaluate_models()
