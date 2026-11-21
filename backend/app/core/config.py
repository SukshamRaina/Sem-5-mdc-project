"""
Configuration and Environment Settings for C-MAPSS Predictive Maintenance Backend.
Loads variables from .env file or system environment with typed Pydantic validation.
"""

from pathlib import Path
from typing import Dict, List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """Application settings with environment variable overrides."""

    PROJECT_NAME: str = "NASA C-MAPSS Predictive Maintenance API"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = False

    # PINN Dataset Configuration
    DEFAULT_DATASET: str = "FD001"
    SUPPORTED_DATASETS: List[str] = ["FD001", "FD002", "FD003", "FD004"]

    # ML Artifact Directories
    ARTIFACTS_DIR: Path = BASE_DIR / "artifacts"
    PINN_ARTIFACTS_DIR: Path = ARTIFACTS_DIR / "pinn"

    # Legacy & Default Artifact Paths (backward compatibility)
    MODEL_PATH: Path = ARTIFACTS_DIR / "lstm_model.keras"
    SCALER_PATH: Path = ARTIFACTS_DIR / "scaler.joblib"
    FEATURE_CONFIG_PATH: Path = ARTIFACTS_DIR / "feature_columns.json"

    # Active Model Metadata
    MODEL_TYPE: str = "PINN"
    MODEL_VERSION: str = "pinn-v1.0"
    SEQUENCE_LENGTH: int = 30
    MAX_RUL_CLIP: float = 125.0

    # Physics-Informed Neural Network (PINN) Loss Hyperparameters
    LAMBDA_PHYSICS: float = 0.1
    LAMBDA_MONOTONICITY: float = 0.1
    LAMBDA_BOUNDARY: float = 0.05
    TIME_SCALE: float = 100.0

    # Training Hyperparameters
    DEFAULT_TRAIN_EPOCHS: int = 35
    DEFAULT_BATCH_SIZE: int = 64
    DEFAULT_LEARNING_RATE: float = 0.001
    DEFAULT_TRAIN_VAL_SPLIT: float = 0.8

    # Upload Guard Rails
    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024  # 10 MB hard ceiling
    MAX_CSV_ROWS: int = 50_000                 # row-count ceiling across all engines

    # Phase 4: Configurable Risk Thresholds (Operational flight cycles)
    # NOTE: Academic prototype decision-support rules; not certified aviation maintenance limits.
    RISK_THRESHOLD_CRITICAL: float = 25.0
    RISK_THRESHOLD_WARNING: float = 50.0
    RISK_THRESHOLD_MODERATE: float = 80.0

    # Phase 4: Maintenance Scheduling Policy Defaults
    DEFAULT_HANGAR_CAPACITY: int = 2
    DEFAULT_MAINTENANCE_LEAD_TIME: int = 5

    # Supabase Database Configuration
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None

    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def get_dataset_artifact_dir(self, dataset: str) -> Path:
        """Returns the isolated artifact directory for a given dataset."""
        return self.PINN_ARTIFACTS_DIR / dataset.upper()

    def get_dataset_model_path(self, dataset: str) -> Path:
        """Returns the trained PINN model checkpoint path for a given dataset."""
        return self.get_dataset_artifact_dir(dataset) / "pinn_model.keras"

    def get_dataset_scaler_path(self, dataset: str) -> Path:
        """Returns the serialized preprocessor scaler path for a given dataset."""
        return self.get_dataset_artifact_dir(dataset) / "scaler.joblib"

    def get_dataset_feature_config_path(self, dataset: str) -> Path:
        """Returns the serialized feature configuration path for a given dataset."""
        return self.get_dataset_artifact_dir(dataset) / "feature_columns.json"


settings = Settings()
