"""
Pydantic schemas for RUL prediction requests, responses, and database records.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CyclePrediction(BaseModel):
    """Historical cycle RUL prediction point."""

    cycle: int = Field(..., description="Operational flight cycle number")
    predicted_rul: float = Field(..., description="Estimated remaining operational cycles")
    risk_level: str = Field(..., description="Risk tier: CRITICAL, WARNING, MODERATE, HEALTHY")


class EnginePrediction(BaseModel):
    """Prediction outcome for a specific turbofan engine."""

    engine_id: int = Field(..., description="Engine unit identification number")
    current_cycle: int = Field(..., description="Latest operational cycle in the provided data")
    cycles_analyzed: int = Field(..., description="Total cycle records processed for this engine")
    predicted_rul: float = Field(..., description="Predicted Remaining Useful Life in cycles")
    risk_level: str = Field(..., description="Risk category: CRITICAL, WARNING, MODERATE, or HEALTHY")
    risk_color: str = Field(..., description="UI hex color code corresponding to the risk level")
    recommendation: str = Field(..., description="Engineering maintenance advisory")
    padded_sequence: bool = Field(False, description="True if cycles < window size and sequence was padded")
    trajectory: Optional[List[CyclePrediction]] = Field(
        default=None, description="Cycle-by-cycle historical RUL degradation curve"
    )
    database_id: Optional[str] = Field(default=None, description="Supabase UUID record identifier")
    priority: Optional[str] = Field(default="P4_DEFERRED", description="Assigned maintenance priority tier")
    risk_assessment: Optional[Dict[str, Any]] = Field(default=None, description="Configurable risk evaluation and prototype disclosures")
    maintenance_recommendation: Optional[Dict[str, Any]] = Field(default=None, description="Actionable advisory with reason and review flag")
    explanation: Optional[Dict[str, Any]] = Field(default=None, description="Gradient-based feature attribution and sensor trend analysis")


class FleetSummary(BaseModel):
    """Aggregated health statistics across all analyzed engines."""

    total_engines: int = Field(..., description="Count of distinct engines evaluated")
    critical_count: int = Field(..., description="Engines with RUL <= 25 cycles")
    warning_count: int = Field(..., description="Engines with 25 < RUL <= 50 cycles")
    moderate_count: int = Field(..., description="Engines with 50 < RUL <= 80 cycles")
    healthy_count: int = Field(..., description="Engines with RUL > 80 cycles")
    min_rul: float = Field(..., description="Lowest predicted RUL in fleet")
    avg_rul: float = Field(..., description="Mean predicted RUL in fleet")
    highest_risk_engine_id: Optional[int] = Field(None, description="Engine unit needing most urgent inspection")


class PredictionResponse(BaseModel):
    """Top-level response payload for CSV inference."""

    success: bool = Field(True, description="Whether inference completed successfully")
    message: str = Field(..., description="Descriptive status message")
    fleet_summary: FleetSummary = Field(..., description="Fleet-level summary statistics")
    predictions: List[EnginePrediction] = Field(..., description="Per-engine prediction list")
    model_version: str = Field(..., description="Model version used for inference")
    features_used: List[str] = Field(..., description="List of sensor features used in model input")
    timestamp: str = Field(..., description="Inference completion timestamp")
    database_status: str = Field(..., description="Status of database storage ('saved_to_supabase' or 'saved_in_memory')")
    fleet_schedule: Optional[Dict[str, Any]] = Field(default=None, description="Automated prioritized fleet maintenance schedule")


class RawCsvRequest(BaseModel):
    """Direct CSV text payload for API/CLI testing."""

    csv_data: str = Field(..., description="Raw CSV string content including headers")
    include_trajectory: bool = Field(True, description="Whether to compute cycle-by-cycle trajectory")


class PredictionRecord(BaseModel):
    """Persistent prediction record retrieved from database."""

    id: str = Field(..., description="Unique record identifier (UUID)")
    engine_id: int = Field(..., description="Engine unit identification number")
    current_cycle: int = Field(..., description="Latest cycle observed")
    cycles_analyzed: int = Field(..., description="Number of cycles submitted")
    predicted_rul: float = Field(..., description="Estimated Remaining Useful Life")
    risk_level: str = Field(..., description="Risk category")
    risk_color: Optional[str] = Field(None, description="Risk indicator color")
    recommendation: Optional[str] = Field(None, description="Maintenance recommendation")
    model_version: str = Field(..., description="Model version")
    features_used: List[str] = Field(default_factory=list, description="Sensor columns used")
    input_metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata and parameters")
    created_at: str = Field(..., description="Record creation timestamp")


class PaginatedPredictions(BaseModel):
    """Paginated list of prediction records."""

    items: List[PredictionRecord] = Field(..., description="List of predictions for current page")
    total: int = Field(..., description="Total matching prediction records in database")
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Records per page")
    total_pages: int = Field(..., description="Total pages available")


class ErrorDetail(BaseModel):
    """Standardized error response schema."""

    error: str = Field(..., description="Error classification")
    detail: Any = Field(..., description="Detailed explanation or field diagnostics")
    timestamp: str = Field(..., description="Error occurrence timestamp")
