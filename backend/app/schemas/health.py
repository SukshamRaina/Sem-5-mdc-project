"""
Pydantic schemas for health and system status endpoints.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """System health and ML model readiness payload."""

    status: str = Field(..., description="Overall health state ('healthy' or 'degraded')")
    model_loaded: bool = Field(..., description="Whether PINN model is resident in memory")
    scaler_loaded: bool = Field(..., description="Whether preprocessing scaler is active")
    model_type: str = Field("PINN", description="Underlying architecture type: PINN")
    model_version: str = Field(..., description="Active ML model version string")
    active_dataset: str = Field("FD001", description="Currently active C-MAPSS dataset")
    supported_datasets: List[str] = Field(default_factory=lambda: ["FD001", "FD002", "FD003", "FD004"], description="All supported C-MAPSS datasets")
    features_count: int = Field(..., description="Number of active sensor input features")
    sequence_length: int = Field(..., description="Sliding-window sequence length")
    database_connected: bool = Field(..., description="Whether Supabase client is connected")
    database_type: str = Field(..., description="'supabase' or 'in-memory-fallback'")
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp")
