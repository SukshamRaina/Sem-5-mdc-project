"""
Physics-Informed Neural Network (PINN) Training Pipeline for NASA C-MAPSS (FD001–FD004).

Features:
- Configurable dataset selection (--dataset FD001|FD002|FD003|FD004|all).
- Engine-aware train/validation partitioning (zero engine row mixing).
- Condition-aware preprocessing fitted strictly on training engines.
- Dual-head PINN architecture with automatic-differentiation physics residual and monotonicity constraints.
- Artifact isolation under backend/artifacts/pinn/{dataset}/.
- Generates convergence curves, parity plots, sample trajectories, and JSON metrics.
"""

import argparse
import json
import logging
import os
from pathlib import Path
import shutil
from typing import Any, Dict, List, Optional
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import tensorflow as tf

from backend.app.ml.pinn_model import (
    PINNTrainer,
    build_pinn_model,
    compute_nasa_phm_score,
    compute_regression_metrics,
)
from backend.app.ml.preprocessor import CMapssPreprocessor, RAW_COLUMNS
from backend.app.ml.sequence import create_sequences, create_test_last_sequences
from backend.ml_pipeline.ingest_data import DATASET_CONFIGS, SUPPORTED_DATASETS, ingest_dataset

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def train_pinn_dataset(
    dataset: str = "FD001",
    data_dir: Optional[Path] = None,
    artifacts_base_dir: Optional[Path] = None,
    sequence_length: int = 30,
    max_rul_clip: float = 125.0,
    train_val_split_ratio: float = 0.8,
    epochs: int = 40,
    batch_size: int = 64,
    learning_rate: float = 0.001,
    lambda_physics: float = 0.1,
    lambda_monotonicity: float = 0.1,
    lambda_boundary: float = 0.05,
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    End-to-end training and evaluation pipeline for a single C-MAPSS dataset.
    Saves all dataset-specific artifacts into backend/artifacts/pinn/{dataset}/.
    """
    dataset = dataset.upper()
    if dataset not in DATASET_CONFIGS:
        raise ValueError(f"Unsupported dataset '{dataset}'. Must be one of {SUPPORTED_DATASETS}")

    # Set seeds for strict reproducibility
    np.random.seed(random_state)
    tf.random.set_seed(random_state)
    os.environ["PYTHONHASHSEED"] = str(random_state)
    os.environ["LOKY_MAX_CPU_COUNT"] = "4"

    base_dir = Path(__file__).resolve().parent.parent
    if data_dir is None:
        data_dir = base_dir / "data" / "raw"
    data_dir = Path(data_dir).resolve()

    if artifacts_base_dir is None:
        artifacts_base_dir = base_dir / "artifacts" / "pinn"
    dataset_artifact_dir = Path(artifacts_base_dir).resolve() / dataset
    plots_dir = dataset_artifact_dir / "plots"
    plots_dir.mkdir(parents=True, exist_ok=True)

    cfg = DATASET_CONFIGS[dataset]
    train_file = data_dir / cfg["train_file"]
    test_file = data_dir / cfg["test_file"]
    rul_file = data_dir / cfg["rul_file"]

    # Auto-ingest if files are not present in data_dir
    if not (train_file.exists() and test_file.exists() and rul_file.exists()):
        logger.info("[%s] Data files missing from %s. Auto-ingesting from archive...", dataset, data_dir)
        ingest_dataset(dataset=dataset, dest_dir=data_dir)

    # 1. Load Data
    logger.info("[%s] Loading raw C-MAPSS files...", dataset)
    train_df = pd.read_csv(train_file, sep=r"\s+", header=None, names=RAW_COLUMNS)
    test_df = pd.read_csv(test_file, sep=r"\s+", header=None, names=RAW_COLUMNS)
    rul_df = pd.read_csv(rul_file, sep=r"\s+", header=None, names=["rul"])
    y_test_true = rul_df["rul"].to_numpy(dtype=np.float32)

    # 2. Engine-aware train/validation partition (Rule 7: zero engine mixing)
    engine_ids = np.sort(train_df["unit_number"].unique())
    rng = np.random.RandomState(random_state)
    shuffled_engines = rng.permutation(engine_ids)
    split_idx = int(len(shuffled_engines) * train_val_split_ratio)
    train_engines = shuffled_engines[:split_idx]
    val_engines = shuffled_engines[split_idx:]

    logger.info(
        "[%s] Engine Partition -> %d total engines: %d train, %d validation",
        dataset,
        len(engine_ids),
        len(train_engines),
        len(val_engines),
    )

    train_subset = train_df[train_df["unit_number"].isin(train_engines)].copy()
    val_subset = train_df[train_df["unit_number"].isin(val_engines)].copy()

    # 3. Fit Preprocessor strictly on training engines subset (Rule 6: zero leakage)
    preprocessor = CMapssPreprocessor(
        dataset=dataset,
        max_rul_clip=max_rul_clip,
    )
    train_labeled = preprocessor.attach_rul_labels(train_subset, clip_upper=True)
    val_labeled = preprocessor.attach_rul_labels(val_subset, clip_upper=True)

    preprocessor.fit(train_labeled)

    # Serialize preprocessor and feature columns
    scaler_save_path = dataset_artifact_dir / "scaler.joblib"
    preprocessor.save(scaler_save_path)

    feature_cols = preprocessor.feature_columns
    feature_config = {
        "dataset": dataset,
        "selected_features": feature_cols,
        "feature_count": len(feature_cols),
        "use_condition_normalization": preprocessor.use_condition_normalization,
        "max_rul_clip": max_rul_clip,
    }
    with open(dataset_artifact_dir / "feature_columns.json", "w", encoding="utf-8") as f:
        json.dump(feature_config, f, indent=2)

    # Transform subsets
    train_scaled = preprocessor.transform(train_labeled)
    val_scaled = preprocessor.transform(val_labeled)

    # 4. Generate Sliding-Window Sequences with temporal coordinates
    X_train, y_train, ids_train, t_train = create_sequences(
        train_scaled,
        sequence_length=sequence_length,
        feature_columns=feature_cols,
        target_column="rul_clipped",
        return_cycles=True,
    )
    X_val, y_val, ids_val, t_val = create_sequences(
        val_scaled,
        sequence_length=sequence_length,
        feature_columns=feature_cols,
        target_column="rul_clipped",
        return_cycles=True,
    )

    logger.info(
        "[%s] Tensors -> X_train: %s | X_val: %s | Features: %d",
        dataset,
        X_train.shape,
        X_val.shape,
        len(feature_cols),
    )

    # 5. Build PINN Model
    model = build_pinn_model(
        sequence_length=sequence_length,
        num_features=len(feature_cols),
        conv_filters=32,
        gru_units_1=48,
        gru_units_2=24,
        dropout_rate=0.2,
        name=f"pinn_regressor_{dataset}",
    )

    trainer = PINNTrainer(
        model=model,
        learning_rate=learning_rate,
        lambda_physics=lambda_physics,
        lambda_monotonicity=lambda_monotonicity,
        lambda_boundary=lambda_boundary,
        max_rul_clip=max_rul_clip,
        time_scale=100.0,
    )

    # 6. Train with early stopping and checkpointing
    checkpoint_path = dataset_artifact_dir / "pinn_best_checkpoint.keras"
    logger.info("[%s] Beginning PINN training for %d epochs...", dataset, epochs)
    history = trainer.fit(
        X_train=X_train,
        t_train=t_train,
        y_train=y_train,
        X_val=X_val,
        t_val=t_val,
        y_val=y_val,
        epochs=epochs,
        batch_size=batch_size,
        patience=10,
        checkpoint_path=checkpoint_path,
        verbose=1,
    )

    # Save final model
    final_model_path = dataset_artifact_dir / "pinn_model.keras"
    model.save(final_model_path)
    logger.info("[%s] Saved final trained PINN model to %s", dataset, final_model_path)

    # Save training history JSON
    with open(dataset_artifact_dir / "training_history.json", "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)

    # 7. Evaluate on held-out test engines
    logger.info("[%s] Evaluating PINN on held-out test engines...", dataset)
    test_scaled = preprocessor.transform(test_df)
    X_test_last, test_engine_ids, t_test_last = create_test_last_sequences(
        test_scaled,
        sequence_length=sequence_length,
        feature_columns=feature_cols,
        return_cycles=True,
    )

    # Predict test RUL
    t_test_norm = (t_test_last.reshape(-1, 1) / 100.0).astype(np.float32)
    test_outputs = model([X_test_last, t_test_norm], training=False)
    test_preds = test_outputs[0].numpy().flatten()
    test_rates = test_outputs[1].numpy().flatten()

    # Ensure finite and non-negative
    test_preds = np.maximum(0.0, np.nan_to_num(test_preds, nan=0.0, posinf=max_rul_clip, neginf=0.0))

    # Evaluate validation metrics
    t_val_norm = (t_val.reshape(-1, 1) / 100.0).astype(np.float32)
    val_outputs = model([X_val, t_val_norm], training=False)
    val_preds = val_outputs[0].numpy().flatten()
    val_metrics = compute_regression_metrics(y_val, val_preds)

    # Evaluate test metrics against official ground truth
    test_metrics = compute_regression_metrics(y_test_true, test_preds)

    # Calculate average physics degradation rate on test
    avg_test_rate = float(np.mean(test_rates))

    logger.info(
        "[%s] Final Test Benchmark -> RMSE: %.2f | MAE: %.2f | R²: %.4f | NASA Score: %.2f | Avg Rate: %.4f",
        dataset,
        test_metrics["rmse"],
        test_metrics["mae"],
        test_metrics["r2_score"],
        test_metrics["nasa_score"],
        avg_test_rate,
    )

    # 8. Visualizations
    # Plot 1: Convergence Curves (Total Loss & Loss Decomposition)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    ax1.plot(history["loss"], label="Train Total Loss", color="#2b6cb0", lw=2)
    ax1.plot(history["val_loss"], label="Val Total Loss", color="#c53030", lw=2, linestyle="--")
    ax1.set_title(f"PINN Total Loss Convergence — {dataset}", fontsize=12, fontweight="bold")
    ax1.set_xlabel("Epoch", fontsize=10)
    ax1.set_ylabel("Loss", fontsize=10)
    ax1.legend()
    ax1.grid(True, linestyle="--", alpha=0.5)

    ax2.plot(history["loss_data"], label="Data MSE Loss", color="#2b6cb0", lw=2)
    ax2.plot(history["loss_physics"], label="Physics Residual Loss", color="#d69e2e", lw=2, linestyle="-.")
    ax2.plot(history["loss_mono"], label="Monotonicity Loss", color="#805ad5", lw=2, linestyle=":")
    ax2.set_title(f"PINN Multi-Objective Loss Decomposition — {dataset}", fontsize=12, fontweight="bold")
    ax2.set_xlabel("Epoch", fontsize=10)
    ax2.set_ylabel("Loss Component", fontsize=10)
    ax2.legend()
    ax2.grid(True, linestyle="--", alpha=0.5)

    plt.tight_layout()
    plt.savefig(plots_dir / "training_history.png", dpi=300)
    plt.close()

    # Plot 2: Parity Plot (True vs Predicted RUL)
    max_val = max(float(y_test_true.max()), float(test_preds.max())) + 15
    plt.figure(figsize=(7, 7))
    plt.scatter(y_test_true, test_preds, alpha=0.75, color="#2b6cb0", edgecolors="black", s=45, label="Test Engines")
    plt.plot([0, max_val], [0, max_val], "k--", lw=1.8, label="Ideal Parity (y = x)")
    plt.fill_between([0, max_val], [0 - 15, max_val - 15], [0 + 15, max_val + 15], color="#2b6cb0", alpha=0.15, label="±15 Cycles Tolerance")
    plt.title(f"PINN Actual vs Predicted RUL Parity — {dataset}\n(RMSE: {test_metrics['rmse']:.2f}, MAE: {test_metrics['mae']:.2f})", fontsize=11, fontweight="bold")
    plt.xlabel("True Remaining Useful Life (Cycles)", fontsize=10)
    plt.ylabel("Predicted Remaining Useful Life (Cycles)", fontsize=10)
    plt.xlim(0, max_val)
    plt.ylim(0, max_val)
    plt.grid(True, linestyle="--", alpha=0.5)
    plt.legend(loc="upper left")
    plt.tight_layout()
    plt.savefig(plots_dir / "parity_plot.png", dpi=300)
    plt.close()

    # Plot 3: Sample Engine Trajectory Tracking
    sample_engine_id = int(test_engine_ids[0])
    sample_df = test_scaled[test_scaled["unit_number"] == sample_engine_id].copy()
    sample_true_final = float(rul_df.iloc[sample_engine_id - 1]["rul"])
    sample_seqs, _, _, sample_cycles = create_sequences(
        sample_df,
        sequence_length=sequence_length,
        feature_columns=feature_cols,
        target_column="unit_number",
        return_cycles=True,
    )
    if len(sample_seqs) > 0:
        sample_t_norm = (sample_cycles.reshape(-1, 1) / 100.0).astype(np.float32)
        sample_preds = model([sample_seqs, sample_t_norm], training=False)[0].numpy().flatten()
        cycles_axis = sample_cycles
        total_engine_life = float(sample_df["time_cycles"].max()) + sample_true_final
        ground_truth_trajectory = [total_engine_life - c for c in cycles_axis]

        plt.figure(figsize=(10, 5))
        plt.plot(cycles_axis, ground_truth_trajectory, color="black", lw=2, linestyle="--", label="Ground Truth Trajectory")
        plt.plot(cycles_axis, sample_preds, color="#2b6cb0", lw=2.2, label="PINN Predicted RUL")
        plt.title(f"PINN Dynamic RUL Degradation Trajectory — {dataset} Test Engine #{sample_engine_id}", fontsize=12, fontweight="bold")
        plt.xlabel("Operational Flight Cycles", fontsize=10)
        plt.ylabel("Remaining Useful Life (Cycles)", fontsize=10)
        plt.grid(True, linestyle="--", alpha=0.5)
        plt.legend()
        plt.tight_layout()
        plt.savefig(plots_dir / f"sample_engine_{sample_engine_id}_trajectory.png", dpi=300)
        plt.close()

    # 9. Save Metadata and Metrics
    metrics_summary = {
        "dataset": dataset,
        "model_architecture": "PINN (Conv1D + GRU(48->24) + Shared Dense + Dual Head [RUL, Rate])",
        "model_type": "PINN",
        "model_version": f"pinn-{dataset.lower()}-v1.0",
        "num_training_engines": len(train_engines),
        "num_validation_engines": len(val_engines),
        "num_test_engines": len(y_test_true),
        "feature_count": len(feature_cols),
        "selected_features": feature_cols,
        "sequence_length": sequence_length,
        "epochs_trained": len(history["loss"]),
        "final_train_loss": history["loss"][-1],
        "final_data_loss": history["loss_data"][-1],
        "final_physics_loss": history["loss_physics"][-1],
        "final_monotonicity_loss": history["loss_mono"][-1],
        "final_val_loss": history["val_loss"][-1],
        "validation_rmse": val_metrics["rmse"],
        "validation_mae": val_metrics["mae"],
        "validation_r2": val_metrics["r2_score"],
        "validation_nasa_score": val_metrics["nasa_score"],
        "test_rmse": test_metrics["rmse"],
        "test_mae": test_metrics["mae"],
        "test_r2": test_metrics["r2_score"],
        "test_nasa_score": test_metrics["nasa_score"],
        "avg_degradation_rate": round(avg_test_rate, 4),
        "physics_config": {
            "lambda_physics": lambda_physics,
            "lambda_monotonicity": lambda_monotonicity,
            "lambda_boundary": lambda_boundary,
            "max_rul_clip": max_rul_clip,
            "time_scale": 100.0,
            "governing_ode": "d(RUL)/dt = -RUL_max * g_theta(X, t)",
            "monotonicity_constraint": "d(RUL)/dt <= 0",
        },
    }

    with open(dataset_artifact_dir / "pinn_metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=2)

    with open(dataset_artifact_dir / "model_metadata.json", "w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=2)

    with open(dataset_artifact_dir / "physics_config.json", "w", encoding="utf-8") as f:
        json.dump(metrics_summary["physics_config"], f, indent=2)

    logger.info("[%s] PINN training and evaluation completed successfully.", dataset)
    return metrics_summary


def train_all_datasets(
    data_dir: Optional[Path] = None,
    artifacts_base_dir: Optional[Path] = None,
    epochs: int = 40,
    batch_size: int = 64,
) -> Dict[str, Dict[str, Any]]:
    """Trains and evaluates PINN models independently across FD001, FD002, FD003, and FD004."""
    results = {}
    for ds in SUPPORTED_DATASETS:
        logger.info("==================================================")
        logger.info(">>> STARTING TRAINING RUN FOR DATASET: %s <<<", ds)
        logger.info("==================================================")
        results[ds] = train_pinn_dataset(
            dataset=ds,
            data_dir=data_dir,
            artifacts_base_dir=artifacts_base_dir,
            epochs=epochs,
            batch_size=batch_size,
        )
    return results


def main():
    parser = argparse.ArgumentParser(description="Train Physics-Informed Neural Network (PINN) on NASA C-MAPSS.")
    parser.add_argument(
        "--dataset",
        type=str,
        default="FD001",
        choices=["FD001", "FD002", "FD003", "FD004", "all", "ALL"],
        help="Dataset subset to train ('FD001', 'FD002', 'FD003', 'FD004', or 'all')",
    )
    parser.add_argument("--epochs", type=int, default=35, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=64, help="Mini-batch size")
    parser.add_argument("--data-dir", type=str, default=None, help="Directory containing raw C-MAPSS data")
    parser.add_argument("--artifacts-dir", type=str, default=None, help="Base artifacts directory")
    args = parser.parse_args()

    data_dir = Path(args.data_dir) if args.data_dir else None
    artifacts_dir = Path(args.artifacts_dir) if args.artifacts_dir else None

    if args.dataset.upper() == "ALL":
        train_all_datasets(
            data_dir=data_dir,
            artifacts_base_dir=artifacts_dir,
            epochs=args.epochs,
            batch_size=args.batch_size,
        )
    else:
        train_pinn_dataset(
            dataset=args.dataset.upper(),
            data_dir=data_dir,
            artifacts_base_dir=artifacts_dir,
            epochs=args.epochs,
            batch_size=args.batch_size,
        )


if __name__ == "__main__":
    main()
