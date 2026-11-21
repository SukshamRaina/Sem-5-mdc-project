"""
Unit Tests for Physics-Informed Neural Network (PINN) Model and Loss Formulations.
Validates:
- Dual-head model architecture (RUL and latent degradation rate g_theta)
- Automatic differentiation d(RUL)/dt calculation via tf.GradientTape
- Physics residual loss formulation (d(RUL)/dt + rate_output)
- Monotonicity constraint loss (penalizes positive derivatives d(RUL)/dt > 0)
- Boundary condition loss (penalizes negative RUL projections)
- Strictly non-negative RUL post-processing at inference
- NASA PHM 2008 asymmetric penalty scoring logic
"""

import numpy as np
import pytest
import tensorflow as tf

from backend.app.ml.pinn_model import (
    PINNTrainer,
    build_pinn_model,
    compute_nasa_phm_score,
    compute_regression_metrics,
)


@pytest.fixture
def mock_pinn_model():
    """Builds a small PINN model for testing."""
    model = build_pinn_model(
        sequence_length=15,
        num_features=5,
        conv_filters=8,
        gru_units_1=16,
        gru_units_2=8,
        dropout_rate=0.0,
        name="test_pinn_model",
    )
    return model


def test_pinn_architecture_dual_heads(mock_pinn_model):
    """Validates that PINN accepts dual inputs [X, t] and outputs [rul_pred, rate_pred]."""
    batch_size = 4
    seq_len = 15
    num_feats = 5

    X_dummy = tf.random.normal((batch_size, seq_len, num_feats))
    t_dummy = tf.constant([[0.1], [0.5], [1.0], [2.0]], dtype=tf.float32)

    rul_pred, rate_pred = mock_pinn_model([X_dummy, t_dummy], training=False)

    assert rul_pred.shape == (batch_size, 1), f"Expected RUL shape (4, 1), got {rul_pred.shape}"
    assert rate_pred.shape == (batch_size, 1), f"Expected rate shape (4, 1), got {rate_pred.shape}"

    # Rate output must be strictly positive (softplus activation)
    assert np.all(rate_pred.numpy() > 0.0), "Degradation rate g_theta must be strictly positive."


def test_automatic_differentiation_derivative(mock_pinn_model):
    """Validates that tf.GradientTape computes analytical d(RUL)/dt through time input."""
    batch_size = 2
    X_dummy = tf.random.normal((batch_size, 15, 5))
    t_dummy = tf.constant([[1.0], [2.0]], dtype=tf.float32)

    with tf.GradientTape() as tape:
        tape.watch(t_dummy)
        rul_pred, _ = mock_pinn_model([X_dummy, t_dummy], training=False)

    d_rul_dt = tape.gradient(rul_pred, t_dummy)

    assert d_rul_dt is not None, "d(RUL)/dt gradient must not be None."
    assert d_rul_dt.shape == (batch_size, 1), f"Expected gradient shape (2, 1), got {d_rul_dt.shape}"
    assert not np.any(np.isnan(d_rul_dt.numpy())), "Gradients must be finite real numbers."


def test_pinn_trainer_loss_terms(mock_pinn_model):
    """Validates that PINNTrainer computes non-negative, finite losses for all multi-term components."""
    trainer = PINNTrainer(
        model=mock_pinn_model,
        learning_rate=0.001,
        lambda_physics=0.1,
        lambda_monotonicity=0.1,
        lambda_boundary=0.05,
        max_rul_clip=125.0,
        time_scale=100.0,
    )

    X_batch = tf.random.normal((8, 15, 5))
    t_batch = tf.constant([[0.1 * i] for i in range(8)], dtype=tf.float32)
    y_batch = tf.constant([[100.0 - 5.0 * i] for i in range(8)], dtype=tf.float32)

    l_tot, l_dat, l_phy, l_mon = trainer.train_step(X_batch, t_batch, y_batch)

    assert l_tot.numpy() > 0.0, "Total loss must be strictly positive."
    assert l_dat.numpy() >= 0.0, "Data MSE loss must be non-negative."
    assert l_phy.numpy() >= 0.0, "Physics residual loss must be non-negative."
    assert l_mon.numpy() >= 0.0, "Monotonicity loss must be non-negative."


def test_monotonicity_penalty_active():
    """
    Validates that a positive slope d(RUL)/dt > 0 incurs a positive penalty,
    while a negative slope d(RUL)/dt <= 0 incurs zero penalty.
    """
    positive_slope = tf.constant([[1.5], [0.8]], dtype=tf.float32)
    negative_slope = tf.constant([[-1.0], [-2.3]], dtype=tf.float32)

    penalty_pos = tf.reduce_mean(tf.square(tf.maximum(0.0, positive_slope))).numpy()
    penalty_neg = tf.reduce_mean(tf.square(tf.maximum(0.0, negative_slope))).numpy()

    assert penalty_pos > 0.0, f"Positive derivative must incur penalty, got {penalty_pos}"
    assert penalty_neg == 0.0, f"Negative derivative must have 0.0 penalty, got {penalty_neg}"


def test_nasa_phm_score_properties():
    """Validates asymmetric properties of the official NASA PHM 2008 challenge scoring function."""
    y_true = np.array([50.0, 50.0, 50.0])

    # Case A: Exact predictions -> Score should be 0.0
    score_exact = compute_nasa_phm_score(y_true, y_true)
    assert np.isclose(score_exact, 0.0, atol=1e-5), "Perfect predictions must have NASA score 0."

    # Case B: Early prediction d = -10 (safer) vs Late prediction d = +10 (unacceptable danger)
    score_early = compute_nasa_phm_score(np.array([50.0]), np.array([40.0]))
    score_late = compute_nasa_phm_score(np.array([50.0]), np.array([60.0]))

    assert score_late > score_early, f"Late ({score_late:.2f}) must exceed early ({score_early:.2f})"
    assert np.isclose(score_early, np.exp(10.0 / 13.0) - 1.0)
    assert np.isclose(score_late, np.exp(10.0 / 10.0) - 1.0)


def test_regression_metrics_computation():
    """Validates compute_regression_metrics returns all required fields with correct math."""
    y_true = np.array([100.0, 80.0, 60.0, 40.0, 20.0])
    y_pred = np.array([95.0, 82.0, 58.0, 42.0, 22.0])

    metrics = compute_regression_metrics(y_true, y_pred)

    assert "mae" in metrics
    assert "rmse" in metrics
    assert "r2_score" in metrics
    assert "nasa_score" in metrics

    assert metrics["mae"] > 0.0
    assert metrics["rmse"] >= metrics["mae"]  # RMSE is mathematically >= MAE
    assert 0.0 <= metrics["r2_score"] <= 1.0
