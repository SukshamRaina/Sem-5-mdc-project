"""
Pydantic Schemas for Phase 4: Risk Analysis, Explainability, and Maintenance Scheduling.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class RiskAssessment(BaseModel):
    """Detailed risk assessment with prototype rule disclosures."""

    level: str = Field(..., description="Risk category: CRITICAL, WARNING, MODERATE, or HEALTHY")
    color: str = Field(..., description="UI hex color code")
    action: str = Field(..., description="High-level operational action")
    priority: str = Field(..., description="Maintenance priority: P1_IMMEDIATE, P2_URGENT, P3_ROUTINE, P4_DEFERRED")
    threshold: str = Field(..., description="Operational cycle threshold description")
    thresholds_used: Dict[str, float] = Field(..., description="Configurable cycle boundaries used")
    is_prototype_rule: bool = Field(True, description="Always true; designates non-certified prototype status")
    disclaimer: str = Field(..., description="Academic non-certification disclaimer")


class MaintenanceRecommendation(BaseModel):
    """Actionable engineering maintenance advisory with reason and human review requirement."""

    priority: str = Field(..., description="Maintenance priority classification")
    action: str = Field(..., description="Specific engineering maintenance action recommended")
    reason: str = Field(..., description="Transparent technical justification based on RUL and degradation")
    human_review_required: bool = Field(True, description="Enforces mandatory human certified sign-off")
    policy_rule: str = Field(..., description="Identifier of the deterministic policy rule evaluated")
    advisory_disclaimer: str = Field(..., description="Academic evaluation disclaimer")


class SensorExplanation(BaseModel):
    """Technical feature attribution and sensor trend explainability."""

    attribution_method: str = Field(..., description="Mathematical feature attribution technique used")
    method_limitation_note: str = Field(..., description="Documentation on why SHAP is unsuitable for the LSTM")
    feature_attributions: Dict[str, float] = Field(..., description="Sensor column -> relative attribution percent (sums to 100)")
    top_contributing_sensors: List[Dict[str, Any]] = Field(..., description="Top 5 degrading sensors with subsystem and trend details")
    sensor_trends: Dict[str, Any] = Field(..., description="Detailed drift slope, direction, and z-scores per sensor")


class EngineScheduleItem(BaseModel):
    """Scheduled maintenance slot assignment for an engine unit."""

    engine_id: int = Field(..., description="Engine identification number")
    priority: str = Field(..., description="Assigned priority tier")
    risk_level: str = Field(..., description="Risk classification")
    predicted_rul: float = Field(..., description="Predicted Remaining Useful Life in cycles")
    current_cycle: int = Field(..., description="Current operational cycle")
    slot_number: int = Field(..., description="Assigned maintenance bay slot sequence")
    scheduled_cycle_target: int = Field(..., description="Operational cycle deadline for maintenance")
    estimated_downtime_cycles: int = Field(5, description="Estimated duration in cycles")
    scheduling_rationale: str = Field(..., description="Explanation of sorting rank and tie-breaking")


class FleetScheduleRequest(BaseModel):
    """Request payload to generate fleet maintenance schedule."""

    hangar_capacity: Optional[int] = Field(2, ge=1, le=20, description="Available concurrent maintenance bays")
    lead_time_cycles: Optional[int] = Field(5, ge=0, le=50, description="Lead time cycles for parts staging")
    engines: Optional[List[Dict[str, Any]]] = Field(None, description="Explicit engines list (optional; if None uses latest batch)")


class FleetScheduleResponse(BaseModel):
    """Optimized fleet maintenance schedule response."""

    total_engines: int = Field(..., description="Number of engines evaluated in schedule")
    hangar_capacity: int = Field(..., description="Hangar bay capacity per slot")
    lead_time_cycles: int = Field(..., description="Lead time buffer cycles applied")
    total_slots: int = Field(..., description="Total sequential maintenance slots required")
    schedule: List[EngineScheduleItem] = Field(..., description="Prioritized list of engine maintenance assignments")
    bottleneck_warning: Optional[str] = Field(None, description="Alert if immediate engines exceed capacity")
    tie_breaking_policy: str = Field(..., description="Deterministic tie-breaking documentation")


class MaintenanceRecordCreate(BaseModel):
    """Schema to log a maintenance work order into the database."""

    prediction_id: Optional[str] = Field(None, description="Optional UUID of associated prediction record")
    engine_id: int = Field(..., description="Engine unit identification number")
    action_taken: str = Field(..., description="Maintenance work order description or action")
    technician_id: Optional[str] = Field(None, description="Technician badge or identifier")
    scheduled_cycle: Optional[int] = Field(None, description="Target operational flight cycle")
    status: str = Field("PENDING", description="Status: PENDING, IN_PROGRESS, COMPLETED, CANCELLED")
    notes: Optional[str] = Field(None, description="Additional technician notes or observations")


class MaintenanceRecordUpdate(BaseModel):
    """Schema to update an existing maintenance record."""

    action_taken: Optional[str] = Field(None, description="Updated action taken")
    technician_id: Optional[str] = Field(None, description="Technician badge or identifier")
    scheduled_cycle: Optional[int] = Field(None, description="Target operational flight cycle")
    status: Optional[str] = Field(None, description="Status: PENDING, IN_PROGRESS, COMPLETED, CANCELLED")
    notes: Optional[str] = Field(None, description="Additional technician notes or observations")


class MaintenanceRecordResponse(BaseModel):
    """Persistent maintenance record returned from database."""

    id: str = Field(..., description="Unique record identifier (UUID)")
    prediction_id: Optional[str] = Field(None, description="Associated prediction record UUID")
    engine_id: int = Field(..., description="Engine unit identification number")
    action_taken: str = Field(..., description="Maintenance action description")
    technician_id: Optional[str] = Field(None, description="Technician badge or identifier")
    scheduled_cycle: Optional[int] = Field(None, description="Target operational flight cycle")
    status: str = Field(..., description="Status: PENDING, IN_PROGRESS, COMPLETED, CANCELLED")
    notes: Optional[str] = Field(None, description="Technician notes")
    created_at: str = Field(..., description="Record creation timestamp")
