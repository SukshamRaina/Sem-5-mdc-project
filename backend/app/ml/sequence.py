"""
Sliding-Window Sequence Generator for Time-Series PINN and Recurrent Modeling.
Transforms tabular 2D engine cycle data into 3D sequential tensors:
    (num_samples, sequence_length, num_features)
Optionally tracks operational cycle coordinates for automatic differentiation.
"""

import logging
from typing import List, Tuple, Union
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def create_sequences(
    df: pd.DataFrame,
    sequence_length: int = 30,
    feature_columns: List[str] | None = None,
    target_column: str = "rul_clipped",
    return_cycles: bool = False,
) -> Union[
    Tuple[np.ndarray, np.ndarray, np.ndarray],
    Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray],
]:
    """
    Generates sliding windows across engine operational cycles.

    Returns:
        If return_cycles=False:
            X: 3D numpy array of shape (N_samples, sequence_length, num_features)
            y: 1D numpy array of shape (N_samples,) containing target RUL at window end
            engine_ids: 1D array of engine unit numbers corresponding to each sequence
        If return_cycles=True:
            X, y, engine_ids, end_cycles (1D array of cycle numbers at the window end)
    """
    if feature_columns is None:
        raise ValueError("feature_columns list must be provided.")

    sequences: List[np.ndarray] = []
    targets: List[float] = []
    engine_ids: List[int] = []
    end_cycles: List[int] = []

    for unit, group in df.groupby("unit_number"):
        features = group[feature_columns].to_numpy(dtype=np.float32)
        has_targets = target_column in group.columns
        target_vals = group[target_column].to_numpy(dtype=np.float32) if has_targets else None
        cycle_vals = group["time_cycles"].to_numpy(dtype=np.int32) if "time_cycles" in group.columns else np.arange(1, len(group) + 1, dtype=np.int32)

        num_cycles = len(group)
        if num_cycles < sequence_length:
            # Pad front with first reading if sequence is shorter than window
            pad_width = sequence_length - num_cycles
            pad = np.repeat(features[:1, :], pad_width, axis=0)
            padded_features = np.vstack([pad, features])
            sequences.append(padded_features)
            if target_vals is not None:
                targets.append(float(target_vals[-1]))
            engine_ids.append(int(unit))
            end_cycles.append(int(cycle_vals[-1]))
            continue

        # Sliding window
        for i in range(num_cycles - sequence_length + 1):
            window = features[i : i + sequence_length]
            sequences.append(window)
            if target_vals is not None:
                targets.append(float(target_vals[i + sequence_length - 1]))
            engine_ids.append(int(unit))
            end_cycles.append(int(cycle_vals[i + sequence_length - 1]))

    X = np.array(sequences, dtype=np.float32)
    y = np.array(targets, dtype=np.float32) if targets else np.empty(0, dtype=np.float32)
    ids = np.array(engine_ids, dtype=np.int32)
    cycles = np.array(end_cycles, dtype=np.int32)

    logger.debug(
        "Generated %d sequences of shape (%d, %d)",
        X.shape[0],
        sequence_length,
        len(feature_columns),
    )
    if return_cycles:
        return X, y, ids, cycles
    return X, y, ids


def create_test_last_sequences(
    df: pd.DataFrame,
    sequence_length: int = 30,
    feature_columns: List[str] | None = None,
    return_cycles: bool = False,
) -> Union[
    Tuple[np.ndarray, np.ndarray],
    Tuple[np.ndarray, np.ndarray, np.ndarray],
]:
    """
    Extracts the single most recent sliding window for each test engine.
    Used for final RUL prediction on test datasets where ground truth RUL is given at the last cycle.

    Returns:
        If return_cycles=False:
            X_last: (num_engines, sequence_length, num_features)
            engine_ids: (num_engines,)
        If return_cycles=True:
            X_last, engine_ids, last_cycles
    """
    if feature_columns is None:
        raise ValueError("feature_columns list must be provided.")

    last_windows: List[np.ndarray] = []
    engine_ids: List[int] = []
    last_cycles: List[int] = []

    for unit, group in df.groupby("unit_number"):
        features = group[feature_columns].to_numpy(dtype=np.float32)
        num_cycles = len(features)
        cycle_vals = group["time_cycles"].to_numpy(dtype=np.int32) if "time_cycles" in group.columns else np.arange(1, len(group) + 1, dtype=np.int32)

        if num_cycles >= sequence_length:
            window = features[-sequence_length:]
        else:
            pad_width = sequence_length - num_cycles
            pad = np.repeat(features[:1, :], pad_width, axis=0)
            window = np.vstack([pad, features])

        last_windows.append(window)
        engine_ids.append(int(unit))
        last_cycles.append(int(cycle_vals[-1]))

    X_last = np.array(last_windows, dtype=np.float32)
    ids = np.array(engine_ids, dtype=np.int32)
    cycles = np.array(last_cycles, dtype=np.int32)

    if return_cycles:
        return X_last, ids, cycles
    return X_last, ids
