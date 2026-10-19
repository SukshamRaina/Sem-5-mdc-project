"""
Exploratory Data Analysis (EDA) & Feature Selection for NASA C-MAPSS FD001.
- Analyzes engine run-to-failure cycle distributions.
- Profiles sensor channels for variance and noise.
- Prunes non-informative constant/zero-variance sensors.
- Generates publication-quality EDA figures for academic documentation.
- Saves feature selection metadata to backend/artifacts/.
"""

import json
import logging
from pathlib import Path
import matplotlib
matplotlib.use("Agg")  # Non-interactive headless backend
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

RAW_COLUMNS = [
    "unit_number",
    "time_cycles",
    "setting_1",
    "setting_2",
    "setting_3",
] + [f"sensor_{i}" for i in range(1, 22)]

# Standard sensor physical descriptions from NASA PHM documentation
SENSOR_NAMES = {
    "sensor_1": "Fan inlet temperature (T2) [°R]",
    "sensor_2": "LPC outlet temperature (T24) [°R]",
    "sensor_3": "HPC outlet temperature (T30) [°R]",
    "sensor_4": "LPT outlet temperature (T50) [°R]",
    "sensor_5": "Fan inlet Pressure (P2) [psia]",
    "sensor_6": "Bypass-duct pressure (P15) [psia]",
    "sensor_7": "HPC outlet pressure (P30) [psia]",
    "sensor_8": "Physical fan speed (Nf) [rpm]",
    "sensor_9": "Physical core speed (Nc) [rpm]",
    "sensor_10": "Engine pressure ratio (P50/P2)",
    "sensor_11": "HPC outlet static pressure (Ps30) [psia]",
    "sensor_12": "Ratio of fuel flow to Ps30 (phi) [pps/psi]",
    "sensor_13": "Corrected fan speed (Nf_dmd) [rpm]",
    "sensor_14": "Corrected core speed (Nc_dmd) [rpm]",
    "sensor_15": "Bypass Ratio (BPR)",
    "sensor_16": "Burner fuel-air ratio (farb)",
    "sensor_17": "Bleed Enthalpy (htBleed)",
    "sensor_18": "Demanded fan speed (Nf_dmd)",
    "sensor_19": "Demanded corrected fan speed (PCNfR_dmd)",
    "sensor_20": "HPT coolant bleed (W31) [lbm/s]",
    "sensor_21": "LPT coolant bleed (W32) [lbm/s]",
}


def load_and_label_training_data(raw_data_path: Path) -> pd.DataFrame:
    """Loads raw train_FD001.txt and attaches linear & piecewise linear RUL targets."""
    df = pd.read_csv(raw_data_path, sep=r"\s+", header=None, names=RAW_COLUMNS)

    # Max operational cycles per engine (run-to-failure)
    max_cycles = df.groupby("unit_number")["time_cycles"].transform("max")
    df["rul"] = max_cycles - df["time_cycles"]

    # Piecewise linear RUL (capped at standard knee point = 125 cycles)
    df["rul_clipped"] = df["rul"].clip(upper=125)
    return df


def run_eda(
    raw_data_dir: Path | None = None,
    artifacts_dir: Path | None = None,
    variance_threshold: float = 1e-4,
) -> dict:
    """Performs statistical profiling, variance thresholding, and saves plots & feature metadata."""
    base_dir = Path(__file__).resolve().parent.parent
    if raw_data_dir is None:
        raw_data_dir = base_dir / "data" / "raw"
    if artifacts_dir is None:
        artifacts_dir = base_dir / "artifacts"

    plots_dir = artifacts_dir / "plots"
    plots_dir.mkdir(parents=True, exist_ok=True)

    train_path = raw_data_dir / "train_FD001.txt"
    if not train_path.exists():
        raise FileNotFoundError(f"Training data not found at {train_path}. Run ingest_data.py first.")

    df = load_and_label_training_data(train_path)
    logger.info("Loaded training data: %d rows, %d engines", len(df), df["unit_number"].nunique())

    # 1. Lifetime distribution analysis
    engine_lifetimes = df.groupby("unit_number")["time_cycles"].max()
    lifetime_stats = {
        "min_cycles": int(engine_lifetimes.min()),
        "max_cycles": int(engine_lifetimes.max()),
        "mean_cycles": float(engine_lifetimes.mean()),
        "median_cycles": float(engine_lifetimes.median()),
        "std_cycles": float(engine_lifetimes.std()),
    }
    logger.info("Engine lifetime statistics: %s", lifetime_stats)

    # Plot 1: Lifetime distribution histogram
    plt.figure(figsize=(9, 5))
    sns.histplot(engine_lifetimes, bins=15, kde=True, color="#2b6cb0", edgecolor="black")
    plt.axvline(engine_lifetimes.mean(), color="crimson", linestyle="--", label=f"Mean: {engine_lifetimes.mean():.1f} cycles")
    plt.axvline(engine_lifetimes.median(), color="forestgreen", linestyle=":", label=f"Median: {engine_lifetimes.median():.1f} cycles")
    plt.title("NASA C-MAPSS FD001: Distribution of Engine Run-to-Failure Cycles", fontsize=13, fontweight="bold")
    plt.xlabel("Total Operational Cycles until Failure", fontsize=11)
    plt.ylabel("Engine Count", fontsize=11)
    plt.legend()
    plt.grid(True, linestyle="--", alpha=0.5)
    plt.tight_layout()
    plt.savefig(plots_dir / "engine_lifetime_distribution.png", dpi=300)
    plt.close()

    # 2. Variance & Degradation Trend Analysis for Feature Selection
    candidate_features = [c for c in df.columns if c.startswith("sensor_") or c.startswith("setting_")]
    variances = df[candidate_features].var()

    # Filter out near-zero variance features
    selected_features = [feat for feat in candidate_features if variances[feat] > variance_threshold]
    pruned_features = [feat for feat in candidate_features if variances[feat] <= variance_threshold]

    logger.info("Selected %d informative features: %s", len(selected_features), selected_features)
    logger.info("Pruned %d constant/non-informative features: %s", len(pruned_features), pruned_features)

    # 3. Correlation with RUL
    correlations = df[selected_features].apply(lambda s: s.corr(df["rul"])).sort_values()
    corr_dict = correlations.to_dict()

    # Plot 2: Feature correlations with RUL
    plt.figure(figsize=(10, 6))
    colors = ["#e53e3e" if c < 0 else "#3182ce" for c in correlations.values]
    correlations.plot(kind="barh", color=colors, edgecolor="black")
    plt.title("Sensor Correlation with Remaining Useful Life (RUL)", fontsize=13, fontweight="bold")
    plt.xlabel("Pearson Correlation Coefficient with Target RUL", fontsize=11)
    plt.ylabel("Sensor / Setting Feature", fontsize=11)
    plt.grid(True, linestyle="--", alpha=0.5)
    plt.tight_layout()
    plt.savefig(plots_dir / "sensor_rul_correlations.png", dpi=300)
    plt.close()

    # Plot 3: Degradation profiles over cycles for Unit #1 across top 6 sensors
    top_6_sensors = correlations.abs().sort_values(ascending=False).head(6).index.tolist()
    unit1_df = df[df["unit_number"] == 1]

    fig, axes = plt.subplots(3, 2, figsize=(12, 9), sharex=True)
    axes = axes.flatten()
    for idx, sensor in enumerate(top_6_sensors):
        sensor_label = SENSOR_NAMES.get(sensor, sensor)
        axes[idx].plot(unit1_df["time_cycles"], unit1_df[sensor], color="#805ad5", lw=1.8)
        axes[idx].set_title(f"{sensor}: {sensor_label}", fontsize=10, fontweight="bold")
        axes[idx].set_ylabel("Measured Value", fontsize=9)
        axes[idx].grid(True, linestyle="--", alpha=0.5)

    axes[-1].set_xlabel("Operational Cycles (Engine #1 to Failure)", fontsize=11)
    axes[-2].set_xlabel("Operational Cycles (Engine #1 to Failure)", fontsize=11)
    plt.suptitle("Sensor Degradation Trajectories: Engine Unit #1 (Run-to-Failure)", fontsize=13, fontweight="bold")
    plt.tight_layout()
    plt.savefig(plots_dir / "unit1_sensor_trajectories.png", dpi=300)
    plt.close()

    # Save feature metadata artifacts for preprocessing and inference
    feature_metadata = {
        "dataset": "NASA C-MAPSS FD001",
        "total_raw_columns": len(RAW_COLUMNS),
        "selected_features": selected_features,
        "pruned_features": pruned_features,
        "variance_threshold": variance_threshold,
        "feature_count": len(selected_features),
        "top_correlated_sensors": top_6_sensors,
        "sensor_descriptions": {f: SENSOR_NAMES.get(f, f) for f in selected_features},
        "target_column": "rul_clipped",
        "max_rul_clip": 125,
        "engine_lifetime_stats": lifetime_stats,
    }

    with open(artifacts_dir / "feature_columns.json", "w", encoding="utf-8") as f:
        json.dump(feature_metadata, f, indent=2)

    with open(artifacts_dir / "eda_summary.json", "w", encoding="utf-8") as f:
        json.dump(
            {
                "lifetime_stats": lifetime_stats,
                "selected_features": selected_features,
                "pruned_features": pruned_features,
                "correlations": corr_dict,
            },
            f,
            indent=2,
        )

    logger.info("EDA completed successfully. Artifacts saved in %s", artifacts_dir)
    return feature_metadata


if __name__ == "__main__":
    run_eda()
