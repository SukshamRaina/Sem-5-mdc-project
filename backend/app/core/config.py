"""
Configuration and Environment Settings for C-MAPSS Predictive Maintenance Backend.
Loads variables from .env file or system environment with typed Pydantic validation.
"""

from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """Application settings with environment variable overrides."""

    PROJECT_NAME: str = "NASA C-MAPSS Predictive Maintenance API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = False

    # ML Artifact Paths
    ARTIFACTS_DIR: Path = BASE_DIR / "artifacts"
    MODEL_PATH: Path = ARTIFACTS_DIR / "lstm_model.keras"
    SCALER_PATH: Path = ARTIFACTS_DIR / "scaler.joblib"
    FEATURE_CONFIG_PATH: Path = ARTIFACTS_DIR / "feature_columns.json"
    MODEL_VERSION: str = "lstm-stacked-v1.0"
    SEQUENCE_LENGTH: int = 30

    # Upload Guard Rails
    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024  # 10 MB hard ceiling
    MAX_CSV_ROWS: int = 50_000                 # row-count ceiling across all engines

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


settings = Settings()
