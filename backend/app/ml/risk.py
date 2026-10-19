"""
Configurable Risk Assessment and Maintenance Recommendation Policies (Phase 4).

Academic Decision-Support Prototype:
The risk tiers, operational thresholds, and priority classifications defined herein
are research decision-support heuristics designed for academic evaluation on the
NASA C-MAPSS dataset. They are NOT certified by the FAA, EASA, or engine OEMs,
and must not be used for direct flight airworthiness dispatch decisions without
human engineering review.
"""

from typing import Any, Dict, List, Optional
from backend.app.core.config import settings

PROTOTYPE_DISCLAIMER: str = (
    "Academic decision-support prototype rule. NOT a certified aviation airworthiness "
    "or dispatch limit. Formal approval by certified aviation maintenance personnel (A&P/Part 66) is required."
)

RISK_TIER_METADATA: Dict[str, Dict[str, Any]] = {
    "CRITICAL": {
        "color": "#dc2626",
        "priority": "P1_IMMEDIATE",
        "default_action": "Ground engine for immediate hot-section borescope inspection and component replacement before next dispatch.",
        "description": "Remaining useful life is at or below critical safety threshold.",
    },
    "WARNING": {
        "color": "#d97706",
        "priority": "P2_URGENT",
        "default_action": "Schedule high-pressure compressor (HPC) inspection and overhaul within the next service planning window.",
        "description": "Progressive degradation observed; maintenance required within planning horizon.",
    },
    "MODERATE": {
        "color": "#2563eb",
        "priority": "P3_ROUTINE",
        "default_action": "Increase sensor trend monitoring frequency; schedule for next scheduled line maintenance depot inspection.",
        "description": "Degradation is within acceptable operational range, but accelerating wear detected.",
    },
    "HEALTHY": {
        "color": "#059669",
        "priority": "P4_DEFERRED",
        "default_action": "Turbofan engine operating within nominal degradation tolerances. Continue routine telemetry logging.",
        "description": "Sensors and remaining life reflect nominal degradation behavior.",
    },
}


def determine_risk_category(
    predicted_rul: float,
    critical_threshold: Optional[float] = None,
    warning_threshold: Optional[float] = None,
    moderate_threshold: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Transparent rule-based risk classification based on predicted Remaining Useful Life (RUL).
    
    Thresholds are fully configurable via backend application settings or runtime overrides:
    - CRITICAL: RUL <= critical_threshold (default: 25.0 cycles)
    - WARNING:  critical_threshold < RUL <= warning_threshold (default: 50.0 cycles)
    - MODERATE: warning_threshold < RUL <= moderate_threshold (default: 80.0 cycles)
    - HEALTHY:  RUL > moderate_threshold (default: > 80.0 cycles)
    """
    c_thresh = critical_threshold if critical_threshold is not None else settings.RISK_THRESHOLD_CRITICAL
    w_thresh = warning_threshold if warning_threshold is not None else settings.RISK_THRESHOLD_WARNING
    m_thresh = moderate_threshold if moderate_threshold is not None else settings.RISK_THRESHOLD_MODERATE

    if predicted_rul <= c_thresh:
        level = "CRITICAL"
        meta = RISK_TIER_METADATA["CRITICAL"]
        thresh_desc = f"<= {c_thresh} cycles"
    elif predicted_rul <= w_thresh:
        level = "WARNING"
        meta = RISK_TIER_METADATA["WARNING"]
        thresh_desc = f"{c_thresh} - {w_thresh} cycles"
    elif predicted_rul <= m_thresh:
        level = "MODERATE"
        meta = RISK_TIER_METADATA["MODERATE"]
        thresh_desc = f"{w_thresh} - {m_thresh} cycles"
    else:
        level = "HEALTHY"
        meta = RISK_TIER_METADATA["HEALTHY"]
        thresh_desc = f"> {m_thresh} cycles"

    return {
        "level": level,
        "color": meta["color"],
        "action": meta["default_action"],
        "priority": meta["priority"],
        "threshold": thresh_desc,
        "thresholds_used": {
            "critical": c_thresh,
            "warning": w_thresh,
            "moderate": m_thresh,
        },
        "is_prototype_rule": True,
        "disclaimer": PROTOTYPE_DISCLAIMER,
    }


def generate_maintenance_recommendation(
    predicted_rul: float,
    risk_level: str,
    engine_id: int,
    current_cycle: int,
    top_contributing_sensors: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Synthesizes a rule-based engineering maintenance priority recommendation.
    
    Includes:
    - Priority classification (P1_IMMEDIATE, P2_URGENT, P3_ROUTINE, P4_DEFERRED)
    - Specific maintenance action
    - Detailed engineering rationale citing predicted RUL, cycle life, and primary degrading sensors
    - Mandatory human review requirement flag
    """
    meta = RISK_TIER_METADATA.get(risk_level, RISK_TIER_METADATA["HEALTHY"])
    priority = meta["priority"]

    # Build sensor attribution clause if available
    sensor_clause = ""
    if top_contributing_sensors and len(top_contributing_sensors) > 0:
        sensor_clause = f" Primary degradation drivers identified in telemetry: {', '.join(top_contributing_sensors[:3])}."

    if priority == "P1_IMMEDIATE":
        action = (
            f"Ground Engine #{engine_id} immediately. Conduct hot-section borescope inspection, "
            f"check High-Pressure Compressor (HPC) stage seals, and prepare replacement unit."
        )
        reason = (
            f"Estimated Remaining Useful Life of {predicted_rul:.1f} operational flight cycles has reached "
            f"critical limit (<= {settings.RISK_THRESHOLD_CRITICAL} cycles). Accumulated {current_cycle} cycles."
            f"{sensor_clause}"
        )
    elif priority == "P2_URGENT":
        target_service_cycle = current_cycle + int(max(1, predicted_rul * 0.5))
        action = (
            f"Schedule depot maintenance for Engine #{engine_id} prior to cycle {target_service_cycle}. "
            f"Inspect compressor bleed valves and fuel ratio calibration."
        )
        reason = (
            f"Predicted RUL of {predicted_rul:.1f} cycles is within warning window "
            f"({settings.RISK_THRESHOLD_CRITICAL} - {settings.RISK_THRESHOLD_WARNING} cycles)."
            f"{sensor_clause}"
        )
    elif priority == "P3_ROUTINE":
        action = (
            f"Assign Engine #{engine_id} to enhanced telemetry tracking. "
            f"Perform routine line maintenance inspection at next overnight turnaround."
        )
        reason = (
            f"Predicted RUL is {predicted_rul:.1f} cycles with moderate degradation wear observed at cycle {current_cycle}."
            f"{sensor_clause}"
        )
    else:  # P4_DEFERRED
        action = f"Engine #{engine_id} is cleared for standard flight operations."
        reason = (
            f"Estimated RUL of {predicted_rul:.1f} cycles is well above nominal wear threshold "
            f"(> {settings.RISK_THRESHOLD_MODERATE} cycles) at cycle {current_cycle}."
        )

    return {
        "priority": priority,
        "action": action,
        "reason": reason,
        "human_review_required": True,
        "policy_rule": f"Rule Tier {priority} based on RUL={predicted_rul:.1f}",
        "advisory_disclaimer": PROTOTYPE_DISCLAIMER,
    }
