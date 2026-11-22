"""
Physics-Informed Neural Network (PINN) Model for Turbofan Engine Remaining Useful Life.

Formulation (Physics-Constrained Empirical Degradation Model):
- Ordinary Differential Equation (ODE) governing component degradation kinetics:
    d(RUL)/dt = -g_theta(X, t),  g_theta(X, t) >= 0
  where g_theta(X, t) represents instantaneous RUL degradation rate in [cycles/cycle].
- Derived latent damage state D(t) in [0, 1]:
    D(t) = 1.0 - RUL(t) / RUL_max,  dD/dt = g_theta(X, t) / RUL_max [1/cycle].
- Exact automatic differentiation of d(RUL)/dt with respect to continuous operational time t.
- Physical Monotonicity Constraint: d(RUL)/dt <= 0 (irreversible mechanical wear / no in-flight healing).
- Boundary Constraints: Non-negative RUL (linear head with bias init +60.0, bounded by L_bound and inference clipping).
- Composite Loss: L_total = L_data + lambda_physics * L_physics + lambda_mono * L_mono + lambda_bound * L_bound.
"""

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import tensorflow as tf
from tensorflow import keras

logger = logging.getLogger(__name__)


def build_pinn_model(
    sequence_length: int = 30,
    num_features: int = 14,
    conv_filters: int = 32,
    gru_units_1: int = 48,
    gru_units_2: int = 24,
    dropout_rate: float = 0.2,
    name: str = "cmapss_pinn_regressor",
) -> keras.Model:
    """
    Constructs a dual-head Physics-Informed Neural Network architecture:
    1. Primary Head: Predicts Remaining Useful Life via unconstrained linear dense layer (bias init +60.0),
       ensuring continuous automatic differentiation gradient flow without saturation; bounded by L_bound and inference clipping.
    2. Physics Head: Predicts instantaneous RUL degradation rate g_theta(X, t) >= 0 via Softplus.
    """
    # Inputs: 3D temporal sequence and 1D continuous operational time coordinate
    sensor_sequence_input = keras.layers.Input(
        shape=(sequence_length, num_features),
        name="sensor_sequence_input",
    )
    time_cycle_input = keras.layers.Input(
        shape=(1,),
        name="time_cycle_input",
    )

    # 1D Temporal Convolution for multi-channel sensor feature extraction
    c = keras.layers.Conv1D(
        filters=conv_filters,
        kernel_size=3,
        padding="same",
        activation="relu",
        name="temporal_conv1d",
    )(sensor_sequence_input)

    # Recurrent GRU backbone for temporal degradation state tracking
    g1 = keras.layers.GRU(
        units=gru_units_1,
        return_sequences=True,
        name="gru_layer_1",
    )(c)
    d1 = keras.layers.Dropout(dropout_rate, name="dropout_1")(g1)

    g2 = keras.layers.GRU(
        units=gru_units_2,
        return_sequences=False,
        name="gru_layer_2",
    )(d1)
    d2 = keras.layers.Dropout(dropout_rate, name="dropout_2")(g2)

    # Merge temporal state representation with continuous time coordinate t
    merged = keras.layers.Concatenate(name="state_time_merge")([d2, time_cycle_input])
    shared = keras.layers.Dense(32, activation="relu", name="shared_representation")(merged)

    # Primary RUL Output Head (linear for unbounded gradient flow during AD, bounded by boundary loss)
    rul_dense = keras.layers.Dense(16, activation="relu", name="rul_dense")(shared)
    rul_output = keras.layers.Dense(
        1,
        activation="linear",
        bias_initializer=keras.initializers.Constant(60.0),
        name="rul_output",
    )(rul_dense)

    # Latent Degradation Rate Head g_theta (strictly non-negative physical wear rate)
    rate_dense = keras.layers.Dense(16, activation="relu", name="rate_dense")(shared)
    rate_output = keras.layers.Dense(1, activation="softplus", name="rate_output")(rate_dense)

    model = keras.Model(
        inputs=[sensor_sequence_input, time_cycle_input],
        outputs=[rul_output, rate_output],
        name=name,
    )
    return model


def compute_nasa_phm_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """
    Computes the NASA PHM 2008 challenge asymmetric scoring metric:
    S = sum(exp(-d / 13) - 1 for d < 0) + sum(exp(d / 10) - 1 for d >= 0)
    where d = y_pred - y_true.
    Penalizes late predictions (d > 0) exponentially more heavily than early ones.
    """
    y_true_arr = np.asarray(y_true, dtype=np.float64).flatten()
    y_pred_arr = np.asarray(y_pred, dtype=np.float64).flatten()
    d = y_pred_arr - y_true_arr
    scores = np.where(d < 0, np.exp(-d / 13.0) - 1.0, np.exp(d / 10.0) - 1.0)
    return float(np.sum(scores))


def compute_regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """Computes RMSE, MAE, R², and NASA asymmetric score."""
    y_t = np.asarray(y_true, dtype=np.float64).flatten()
    y_p = np.asarray(y_pred, dtype=np.float64).flatten()

    mae = float(np.mean(np.abs(y_t - y_p)))
    mse = float(np.mean((y_t - y_p) ** 2))
    rmse = float(np.sqrt(mse))

    ss_tot = np.sum((y_t - np.mean(y_t)) ** 2)
    ss_res = np.sum((y_t - y_p) ** 2)
    r2 = float(1.0 - (ss_res / (ss_tot + 1e-12))) if ss_tot > 1e-12 else 0.0

    nasa_score = compute_nasa_phm_score(y_t, y_p)

    return {
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "r2_score": round(r2, 4),
        "nasa_score": round(nasa_score, 2),
    }


class PINNTrainer:
    """
    Orchestrates gradient-based training for Physics-Informed Neural Networks.
    Tracks automatic differentiation derivatives, evaluates composite physics loss,
    and supports early stopping and best checkpoint restoration.
    """

    def __init__(
        self,
        model: keras.Model,
        learning_rate: float = 0.001,
        lambda_physics: float = 0.1,
        lambda_monotonicity: float = 0.1,
        lambda_boundary: float = 0.05,
        max_rul_clip: float = 125.0,
        time_scale: float = 100.0,
    ):
        self.model = model
        self.optimizer = keras.optimizers.Adam(learning_rate=learning_rate)
        self.lambda_physics = float(lambda_physics)
        self.lambda_monotonicity = float(lambda_monotonicity)
        self.lambda_boundary = float(lambda_boundary)
        self.max_rul_clip = float(max_rul_clip)
        self.time_scale = float(time_scale)

    @tf.function
    def train_step(
        self,
        X_batch: tf.Tensor,
        t_batch: tf.Tensor,
        y_batch: tf.Tensor,
    ) -> Tuple[tf.Tensor, tf.Tensor, tf.Tensor, tf.Tensor]:
        """
        Executes one forward-backward optimization step.
        Computes analytical d(RUL)/dt via automatic differentiation and optimizes composite loss.
        """
        with tf.GradientTape() as outer_tape:
            with tf.GradientTape() as inner_tape:
                inner_tape.watch(t_batch)
                rul_pred, rate_pred = self.model([X_batch, t_batch], training=True)

            # 1. Automatic Differentiation: d(RUL)/dt
            d_rul_dt_raw = inner_tape.gradient(rul_pred, t_batch)
            if d_rul_dt_raw is None:
                d_rul_dt_raw = tf.zeros_like(rul_pred)
            d_rul_dt = (1.0 / self.time_scale) * d_rul_dt_raw

            # 2. Physics Residual Loss: d(RUL)/dt = -rate_pred -> r = d(RUL)/dt + rate_pred
            physics_residual = d_rul_dt + rate_pred
            loss_physics = tf.reduce_mean(tf.square(physics_residual))

            # 3. Monotonicity Constraint Loss: d(RUL)/dt <= 0 (penalize positive derivatives)
            loss_mono = tf.reduce_mean(tf.square(tf.maximum(0.0, d_rul_dt)))

            # 4. Supervised Data Loss: Mean Squared Error against labeled target
            loss_data = tf.reduce_mean(tf.square(y_batch - rul_pred))

            # 5. Boundary Condition Loss: penalize any negative RUL projection
            loss_bound = tf.reduce_mean(tf.square(tf.maximum(0.0, -rul_pred)))

            # 6. Total Composite Objective
            loss_total = (
                loss_data
                + self.lambda_physics * loss_physics
                + self.lambda_monotonicity * loss_mono
                + self.lambda_boundary * loss_bound
            )

        gradients = outer_tape.gradient(loss_total, self.model.trainable_variables)

        # Gradient clipping to ensure numerical stability during AD
        clipped_gradients, _ = tf.clip_by_global_norm(gradients, 5.0)
        self.optimizer.apply_gradients(zip(clipped_gradients, self.model.trainable_variables))

        return loss_total, loss_data, loss_physics, loss_mono

    @tf.function
    def val_step(
        self,
        X_batch: tf.Tensor,
        t_batch: tf.Tensor,
        y_batch: tf.Tensor,
    ) -> Tuple[tf.Tensor, tf.Tensor, tf.Tensor, tf.Tensor, tf.Tensor]:
        """Evaluates validation loss terms and predictions."""
        with tf.GradientTape() as tape:
            tape.watch(t_batch)
            rul_pred, rate_pred = self.model([X_batch, t_batch], training=False)
            d_rul_dt_raw = tape.gradient(rul_pred, t_batch)
            if d_rul_dt_raw is None:
                d_rul_dt_raw = tf.zeros_like(rul_pred)
            d_rul_dt = (1.0 / self.time_scale) * d_rul_dt_raw

            physics_residual = d_rul_dt + rate_pred
            loss_physics = tf.reduce_mean(tf.square(physics_residual))
            loss_mono = tf.reduce_mean(tf.square(tf.maximum(0.0, d_rul_dt)))
            loss_data = tf.reduce_mean(tf.square(y_batch - rul_pred))
            loss_bound = tf.reduce_mean(tf.square(tf.maximum(0.0, -rul_pred)))

            loss_total = (
                loss_data
                + self.lambda_physics * loss_physics
                + self.lambda_monotonicity * loss_mono
                + self.lambda_boundary * loss_bound
            )

        return loss_total, loss_data, loss_physics, loss_mono, rul_pred

    def fit(
        self,
        X_train: np.ndarray,
        t_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        t_val: np.ndarray,
        y_val: np.ndarray,
        epochs: int = 35,
        batch_size: int = 64,
        patience: int = 10,
        checkpoint_path: Optional[Union[Path, str]] = None,
        verbose: int = 1,
    ) -> Dict[str, List[float]]:
        """
        Executes complete training loop with batching, validation monitoring,
        early stopping, and best model weight restoration.
        """
        # Ensure float32 tensors with proper 2D shape for targets
        y_train_2d = y_train.reshape(-1, 1).astype(np.float32)
        y_val_2d = y_val.reshape(-1, 1).astype(np.float32)
        t_train_norm = (t_train.reshape(-1, 1) / self.time_scale).astype(np.float32)
        t_val_norm = (t_val.reshape(-1, 1) / self.time_scale).astype(np.float32)

        train_dataset = (
            tf.data.Dataset.from_tensor_slices((X_train, t_train_norm, y_train_2d))
            .shuffle(buffer_size=len(X_train), seed=42)
            .batch(batch_size)
            .prefetch(tf.data.AUTOTUNE)
        )

        history = {
            "loss": [],
            "loss_data": [],
            "loss_physics": [],
            "loss_mono": [],
            "val_loss": [],
            "val_loss_data": [],
            "val_rmse": [],
            "val_mae": [],
        }

        best_val_loss = float("inf")
        best_weights = None
        patience_counter = 0

        for epoch in range(1, epochs + 1):
            train_total_list = []
            train_data_list = []
            train_phys_list = []
            train_mono_list = []

            for X_b, t_b, y_b in train_dataset:
                l_tot, l_dat, l_phy, l_mon = self.train_step(X_b, t_b, y_b)
                train_total_list.append(float(l_tot.numpy()))
                train_data_list.append(float(l_dat.numpy()))
                train_phys_list.append(float(l_phy.numpy()))
                train_mono_list.append(float(l_mon.numpy()))

            # Validation evaluation
            val_X_t = tf.convert_to_tensor(X_val, dtype=tf.float32)
            val_t_t = tf.convert_to_tensor(t_val_norm, dtype=tf.float32)
            val_y_t = tf.convert_to_tensor(y_val_2d, dtype=tf.float32)

            v_tot, v_dat, v_phy, v_mon, v_preds = self.val_step(val_X_t, val_t_t, val_y_t)
            v_preds_np = np.maximum(0.0, v_preds.numpy().flatten())
            val_rmse = float(np.sqrt(np.mean((y_val - v_preds_np) ** 2)))
            val_mae = float(np.mean(np.abs(y_val - v_preds_np)))

            ep_loss = float(np.mean(train_total_list))
            ep_dat = float(np.mean(train_data_list))
            ep_phy = float(np.mean(train_phys_list))
            ep_mon = float(np.mean(train_mono_list))
            ep_val_loss = float(v_tot.numpy())
            ep_val_dat = float(v_dat.numpy())

            history["loss"].append(round(ep_loss, 4))
            history["loss_data"].append(round(ep_dat, 4))
            history["loss_physics"].append(round(ep_phy, 4))
            history["loss_mono"].append(round(ep_mon, 4))
            history["val_loss"].append(round(ep_val_loss, 4))
            history["val_loss_data"].append(round(ep_val_dat, 4))
            history["val_rmse"].append(round(val_rmse, 3))
            history["val_mae"].append(round(val_mae, 3))

            if verbose:
                logger.info(
                    "Epoch %d/%d — Loss: %.2f (Data: %.2f, Phys: %.3f, Mono: %.3f) | Val Loss: %.2f | Val RMSE: %.2f",
                    epoch,
                    epochs,
                    ep_loss,
                    ep_dat,
                    ep_phy,
                    ep_mon,
                    ep_val_loss,
                    val_rmse,
                )

            # Checkpointing and Early Stopping
            if ep_val_loss < best_val_loss:
                best_val_loss = ep_val_loss
                best_weights = self.model.get_weights()
                patience_counter = 0
                if checkpoint_path:
                    chkp_p = Path(checkpoint_path)
                    chkp_p.parent.mkdir(parents=True, exist_ok=True)
                    self.model.save(chkp_p)
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    logger.info("Early stopping triggered at epoch %d (patience = %d)", epoch, patience)
                    break

        # Restore best weights
        if best_weights is not None:
            self.model.set_weights(best_weights)
            logger.info("Restored best model weights with validation loss: %.4f", best_val_loss)

        return history
