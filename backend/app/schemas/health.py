"""
Pydantic schemas for health and system status endpoints.
"""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """System health and ML model readiness payload."""

    status: str = Field(..., description="Overall health state ('healthy' or 'degraded')")
    model_loaded: bool = Field(..., description="Whether LSTM model is resident in memory")
    scaler_loaded: bool = Field(..., description="Whether preprocessing scaler is active")
    model_version: str = Field(..., description="Active ML model version string")
    features_count: int = Field(..., description="Number of active sensor input features")
    sequence_length: int = Field(..., description="Sliding-window sequence length")
    database_connected: bool = Field(..., description="Whether Supabase client is connected")
    database_type: str = Field(..., description="'supabase' or 'in-memory-fallback'")
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp")
