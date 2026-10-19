"""
Unit Tests for C-MAPSS Preprocessing Pipeline (Phase 1).
Validates:
- Normalization stability and value ranges
- Zero data leakage (Rule 6)
- Missing column validation
- RUL target calculation and piecewise clipping
- Artifact serialization & deserialization round-trip
"""

import tempfile
from pathlib import Path
import numpy as np
import pandas as pd
import pytest

from backend.app.ml.preprocessor import CMapssPreprocessor, DEFAULT_FEATURE_COLUMNS


@pytest.fixture
def sample_engine_data():
    """Generates synthetic multi-engine cycle data matching C-MAPSS schema."""
    rows = []
    # 3 engines with varying lifetimes: 40, 50, 60 cycles
    for unit, max_c in [(1, 40), (2, 50), (3, 60)]:
        for c in range(1, max_c + 1):
            row = {"unit_number": unit, "time_cycles": c, "setting_1": 0.0, "setting_2": 0.0, "setting_3": 100.0}
            for i, feat in enumerate(DEFAULT_FEATURE_COLUMNS):
                # Simulated degradation drift
                row[feat] = 500.0 + i * 10.0 + (c / max_c) * 20.0 + np.random.normal(0, 0.1)
            rows.append(row)
    return pd.DataFrame(rows)


def test_attach_rul_labels(sample_engine_data):
    """Tests calculation of linear countdown and piecewise clipping."""
    preprocessor = CMapssPreprocessor(max_rul_clip=30.0)
    labeled = preprocessor.attach_rul_labels(sample_engine_data, clip_upper=True)

    assert "rul" in labeled.columns
    assert "rul_clipped" in labeled.columns

    # Engine 1 has 40 cycles. At cycle 1: rul = 39, rul_clipped = 30
    e1_c1 = labeled[(labeled["unit_number"] == 1) & (labeled["time_cycles"] == 1)].iloc[0]
    assert e1_c1["rul"] == 39
    assert e1_c1["rul_clipped"] == 30.0

    # At cycle 40: rul = 0, rul_clipped = 0
    e1_c40 = labeled[(labeled["unit_number"] == 1) & (labeled["time_cycles"] == 40)].iloc[0]
    assert e1_c40["rul"] == 0
    assert e1_c40["rul_clipped"] == 0.0


def test_preprocessor_fit_and_transform(sample_engine_data):
    """Tests scaling range [0, 1] and absence of NaN values."""
    preprocessor = CMapssPreprocessor()
    transformed = preprocessor.fit_transform(sample_engine_data)

    for col in preprocessor.feature_columns:
        assert transformed[col].min() >= -1e-5
        assert transformed[col].max() <= 1.0 + 1e-5
        assert not transformed[col].isna().any()


def test_missing_column_raises_error(sample_engine_data):
    """Tests that missing expected sensor columns raises ValueError."""
    bad_df = sample_engine_data.drop(columns=["sensor_2"])
    preprocessor = CMapssPreprocessor()
    with pytest.raises(ValueError, match="Missing required sensor columns"):
        preprocessor.fit(bad_df)


def test_zero_data_leakage(sample_engine_data):
    """Tests that preprocessor fitted on Train does not alter its parameters based on Test."""
    train_df = sample_engine_data[sample_engine_data["unit_number"] == 1].copy()
    test_df = sample_engine_data[sample_engine_data["unit_number"] == 2].copy()

    preprocessor = CMapssPreprocessor()
    preprocessor.fit(train_df)
    train_min = preprocessor.scaler.data_min_.copy()

    # Transforming test_df should NOT modify preprocessor internal min/max
    _ = preprocessor.transform(test_df)
    np.testing.assert_array_equal(preprocessor.scaler.data_min_, train_min)


def test_preprocessor_serialization(sample_engine_data):
    """Tests saving and loading preprocessor with complete fidelity."""
    preprocessor = CMapssPreprocessor()
    preprocessor.fit(sample_engine_data)
    expected_transform = preprocessor.transform(sample_engine_data)

    with tempfile.TemporaryDirectory() as tmp_dir:
        save_path = Path(tmp_dir) / "test_scaler.joblib"
        preprocessor.save(save_path)
        assert save_path.exists()

        loaded = CMapssPreprocessor.load(save_path)
        loaded_transform = loaded.transform(sample_engine_data)

        pd.testing.assert_frame_equal(expected_transform, loaded_transform)
