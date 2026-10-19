"""
Deep Learning LSTM Model Training for NASA C-MAPSS FD001 Turbofan Engine RUL.
Features:
- Engine-aware training/validation partition (Rule 7: no row mixing across engines).
- Strict fitting of normalization scaler solely on training engines (Rule 6: zero leakage).
- 30-cycle sliding window sequence creation.
- 2-layer LSTM with Dropout regularization to prevent overfitting on sensor noise.
- EarlyStopping & ModelCheckpoint callbacks.
- Loss and metric history visualization saved to artifacts/plots/.
- Serializes trained model (.keras) and preprocessor bundle (.joblib).
"""

import json
import logging
import os
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
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


def build_lstm_model(sequence_length: int, num_features: int) -> keras.Model:
    """Builds a stacked LSTM regression network with dropout and dense projection."""
    model = keras.Sequential(
        [
            keras.layers.Input(shape=(sequence_length, num_features), name="sensor_sequence_input"),
            keras.layers.LSTM(64, return_sequences=True, name="lstm_layer_1"),
            keras.layers.Dropout(0.2, name="dropout_1"),
            keras.layers.LSTM(32, return_sequences=False, name="lstm_layer_2"),
            keras.layers.Dropout(0.2, name="dropout_2"),
            keras.layers.Dense(32, activation="relu", name="dense_proj"),
            keras.layers.Dense(1, activation="linear", name="rul_output"),
        ],
        name="cmapss_lstm_regressor",
    )

    optimizer = keras.optimizers.Adam(learning_rate=0.001)
    model.compile(
        optimizer=optimizer,
        loss="mse",
        metrics=["mae", keras.metrics.RootMeanSquaredError(name="rmse")],
    )
    return model


def train_lstm_model(
    data_dir: Path | None = None,
    artifacts_dir: Path | None = None,
    sequence_length: int = 30,
    max_rul_clip: float = 125.0,
    train_val_split_ratio: float = 0.8,
    epochs: int = 35,
    batch_size: int = 64,
    random_state: int = 42,
) -> dict:
    """End-to-end training pipeline for LSTM RUL predictor."""
    # Set seeds for reproducibility
    np.random.seed(random_state)
    tf.random.set_seed(random_state)

    base_dir = Path(__file__).resolve().parent.parent
    if data_dir is None:
        data_dir = base_dir / "data" / "raw"
    if artifacts_dir is None:
        artifacts_dir = base_dir / "artifacts"
    plots_dir = artifacts_dir / "plots"
    plots_dir.mkdir(parents=True, exist_ok=True)

    # 1. Load data
    train_df = pd.read_csv(data_dir / "train_FD001.txt", sep=r"\s+", header=None, names=RAW_COLUMNS)
    test_df = pd.read_csv(data_dir / "test_FD001.txt", sep=r"\s+", header=None, names=RAW_COLUMNS)
    rul_df = pd.read_csv(data_dir / "RUL_FD001.txt", sep=r"\s+", header=None, names=["rul"])

    # 2. Engine-aware train/validation partition (Rule 7)
    engine_ids = np.sort(train_df["unit_number"].unique())
    shuffled_engines = np.random.permutation(engine_ids)
    split_idx = int(len(shuffled_engines) * train_val_split_ratio)
    train_engines = shuffled_engines[:split_idx]
    val_engines = shuffled_engines[split_idx:]

    logger.info("Partitioned %d total engines: %d train, %d validation", len(engine_ids), len(train_engines), len(val_engines))

    train_subset = train_df[train_df["unit_number"].isin(train_engines)].copy()
    val_subset = train_df[train_df["unit_number"].isin(val_engines)].copy()

    # 3. Fit Preprocessor strictly on training engines (Rule 5 & Rule 6)
    preprocessor = CMapssPreprocessor(max_rul_clip=max_rul_clip)
    train_labeled = preprocessor.attach_rul_labels(train_subset, clip_upper=True)
    val_labeled = preprocessor.attach_rul_labels(val_subset, clip_upper=True)

    preprocessor.fit(train_labeled)
    # Save the fitted scaler artifact immediately
    scaler_artifact_path = artifacts_dir / "scaler.joblib"
    preprocessor.save(scaler_artifact_path)

    # Transform subsets
    train_scaled = preprocessor.transform(train_labeled)
    val_scaled = preprocessor.transform(val_labeled)
    feature_cols = preprocessor.feature_columns

    # 4. Generate Sliding-Window Sequences
    X_train, y_train, _ = create_sequences(
        train_scaled,
        sequence_length=sequence_length,
        feature_columns=feature_cols,
        target_column="rul_clipped",
    )
    X_val, y_val, _ = create_sequences(
        val_scaled,
        sequence_length=sequence_length,
        feature_columns=feature_cols,
        target_column="rul_clipped",
    )

    logger.info("Tensor shapes -> X_train: %s, y_train: %s | X_val: %s, y_val: %s", X_train.shape, y_train.shape, X_val.shape, y_val.shape)

    # 5. Build and Train Model
    model = build_lstm_model(sequence_length=sequence_length, num_features=len(feature_cols))
    model.summary(print_fn=logger.info)

    checkpoint_path = artifacts_dir / "lstm_best_checkpoint.keras"
    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=10,
            restore_best_weights=True,
            verbose=1,
        ),
        keras.callbacks.ModelCheckpoint(
            filepath=checkpoint_path,
            monitor="val_loss",
            save_best_only=True,
            verbose=0,
        ),
    ]

    history = model.fit(
        X_train,
        y_train,
        validation_data=(X_val, y_val),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=callbacks,
        verbose=1,
    )

    # 6. Save final production model
    final_model_path = artifacts_dir / "lstm_model.keras"
    model.save(final_model_path)
    logger.info("Saved trained LSTM model to %s", final_model_path)

    # 7. Evaluate on held-out test engines
    test_scaled = preprocessor.transform(test_df)
    X_test_last, _ = create_test_last_sequences(test_scaled, sequence_length=sequence_length, feature_columns=feature_cols)
    y_test_true = rul_df["rul"].values

    test_preds = model.predict(X_test_last).flatten()

    # Metrics computation
    val_eval = model.evaluate(X_val, y_val, verbose=0)
    val_loss, val_mae, val_rmse = val_eval[0], val_eval[1], val_eval[2]

    test_rmse = float(np.sqrt(np.mean((y_test_true - test_preds) ** 2)))
    test_mae = float(np.mean(np.abs(y_test_true - test_preds)))

    # NASA PHM 2008 scoring function
    d = test_preds - y_test_true
    nasa_score = float(np.sum(np.where(d < 0, np.exp(-d / 13.0) - 1.0, np.exp(d / 10.0) - 1.0)))

    logger.info("Final Evaluation -> Val RMSE: %.2f | Test RMSE: %.2f | Test MAE: %.2f | NASA Score: %.2f", val_rmse, test_rmse, test_mae, nasa_score)

    # 8. Plot Training History
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    ax1.plot(history.history["loss"], label="Train MSE Loss", color="#3182ce", lw=2)
    ax1.plot(history.history["val_loss"], label="Validation MSE Loss", color="#e53e3e", lw=2, linestyle="--")
    ax1.set_title("LSTM Loss Convergence Across Epochs", fontsize=12, fontweight="bold")
    ax1.set_xlabel("Epoch", fontsize=10)
    ax1.set_ylabel("Mean Squared Error (MSE)", fontsize=10)
    ax1.legend()
    ax1.grid(True, linestyle="--", alpha=0.5)

    ax2.plot(history.history["rmse"], label="Train RMSE", color="#3182ce", lw=2)
    ax2.plot(history.history["val_rmse"], label="Validation RMSE", color="#e53e3e", lw=2, linestyle="--")
    ax2.set_title("Root Mean Squared Error (RMSE) Curve", fontsize=12, fontweight="bold")
    ax2.set_xlabel("Epoch", fontsize=10)
    ax2.set_ylabel("RMSE (Cycles)", fontsize=10)
    ax2.legend()
    ax2.grid(True, linestyle="--", alpha=0.5)

    plt.tight_layout()
    plt.savefig(plots_dir / "lstm_training_history.png", dpi=300)
    plt.close()

    # 9. Save metrics summary
    metrics = {
        "model_architecture": "Stacked LSTM (64 -> 32) + Dense(32) + Linear",
        "sequence_length": sequence_length,
        "feature_count": len(feature_cols),
        "selected_features": feature_cols,
        "training_epochs_run": len(history.history["loss"]),
        "validation_rmse": round(float(val_rmse), 3),
        "validation_mae": round(float(val_mae), 3),
        "test_rmse": round(test_rmse, 3),
        "test_mae": round(test_mae, 3),
        "test_nasa_score": round(nasa_score, 2),
    }

    with open(artifacts_dir / "lstm_metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    return metrics


if __name__ == "__main__":
    train_lstm_model()
