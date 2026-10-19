"""
Unit Tests for Machine Learning Models and Sequence Generation (Phase 1).
Validates:
- Sliding window sequence tensor dimensions
- Short engine zero/edge padding
- NASA PHM 2008 asymmetric scoring logic
- Transparent risk rule classification
- Model artifact loading and forward pass
"""

from pathlib import Path
import joblib
import numpy as np
import pandas as pd
import pytest

from backend.app.ml.predictor import determine_risk_category
from backend.app.ml.preprocessor import DEFAULT_FEATURE_COLUMNS
from backend.app.ml.sequence import create_sequences, create_test_last_sequences
from backend.ml_pipeline.evaluate import compute_nasa_phm_score


@pytest.fixture
def mock_engine_df():
    """Generates mock engine trajectory with 50 operational cycles."""
    rows = []
    for c in range(1, 51):
        row = {"unit_number": 1, "time_cycles": c, "rul_clipped": 50.0 - c}
        for feat in DEFAULT_FEATURE_COLUMNS:
            row[feat] = 0.5 + 0.005 * c
        rows.append(row)
    return pd.DataFrame(rows)


def test_create_sequences_shape(mock_engine_df):
    """Tests sliding window sequence generation output dimensions."""
    seq_len = 30
    X, y, ids = create_sequences(
        mock_engine_df,
        sequence_length=seq_len,
        feature_columns=DEFAULT_FEATURE_COLUMNS,
        target_column="rul_clipped",
    )

    # 50 cycles with window of 30 produces 50 - 30 + 1 = 21 windows
    assert X.shape == (21, seq_len, len(DEFAULT_FEATURE_COLUMNS))
    assert y.shape == (21,)
    assert ids.shape == (21,)
    assert np.all(ids == 1)


def test_short_engine_padding(mock_engine_df):
    """Tests that an engine with fewer cycles than window length is padded safely."""
    short_df = mock_engine_df.iloc[:12].copy()  # Only 12 cycles
    seq_len = 30

    X_last, ids = create_test_last_sequences(
        short_df, sequence_length=seq_len, feature_columns=DEFAULT_FEATURE_COLUMNS
    )

    assert X_last.shape == (1, seq_len, len(DEFAULT_FEATURE_COLUMNS))
    assert ids.shape == (1,)
    # Verify padded values match the earliest cycle readings
    np.testing.assert_array_equal(X_last[0, 0], X_last[0, 17])


def test_nasa_phm_score_penalty_asymmetry():
    """
    Tests that a late prediction (d = +10 cycles) carries a significantly
    higher penalty than an early prediction (d = -10 cycles).
    d = y_pred - y_true
    """
    y_true = np.array([50.0, 50.0])
    # Case A: Late prediction (+10 cycles)
    y_pred_late = np.array([60.0])
    # Case B: Early prediction (-10 cycles)
    y_pred_early = np.array([40.0])

    score_late = compute_nasa_phm_score(np.array([50.0]), y_pred_late)
    score_early = compute_nasa_phm_score(np.array([50.0]), y_pred_early)

    assert score_late > score_early, f"Late penalty ({score_late:.2f}) must exceed early penalty ({score_early:.2f})"
    assert np.isclose(score_late, np.exp(10 / 10.0) - 1.0)
    assert np.isclose(score_early, np.exp(10 / 13.0) - 1.0)


def test_risk_category_rules():
    """Validates the 4 deterministic risk thresholds."""
    crit = determine_risk_category(15.0)
    assert crit["level"] == "CRITICAL"

    warn = determine_risk_category(35.0)
    assert warn["level"] == "WARNING"

    mod = determine_risk_category(65.0)
    assert mod["level"] == "MODERATE"

    healthy = determine_risk_category(95.0)
    assert healthy["level"] == "HEALTHY"


def test_baseline_model_artifact():
    """Tests that the trained baseline model artifact loads and predicts correctly."""
    artifact_path = Path("backend/artifacts/baseline_model.joblib")
    if not artifact_path.exists():
        pytest.skip("Baseline artifact not yet trained.")

    bundle = joblib.load(artifact_path)
    model = bundle["model"]
    feature_cols = bundle["feature_columns"]

    dummy_sample = np.ones((1, len(feature_cols))) * 0.5
    pred = model.predict(dummy_sample)

    assert len(pred) == 1
    assert pred[0] > 0


def test_cmapss_predictor_e2e_inference(mock_engine_df):
    """Tests CMapssPredictor end-to-end single-engine inference with realistic sensor data."""
    from backend.app.ml.predictor import CMapssPredictor

    predictor = CMapssPredictor()
    predictor.load()

    # Predict current state
    result = predictor.predict_engine(mock_engine_df)
    assert result["engine_id"] == 1
    assert result["current_cycle"] == 50
    assert result["predicted_rul"] >= 0.0
    assert result["risk_level"] in ["CRITICAL", "WARNING", "MODERATE", "HEALTHY"]

    # Predict historical trajectory
    trajectory = predictor.predict_trajectory(mock_engine_df)
    assert len(trajectory) == 21  # 50 - 30 + 1
    assert trajectory[0]["cycle"] == 30
    assert trajectory[-1]["cycle"] == 50

