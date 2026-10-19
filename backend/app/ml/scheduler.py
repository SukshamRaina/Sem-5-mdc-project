"""
Fleet Maintenance Scheduling and Optimization Module (Phase 4).

Deterministic Multi-Criteria Prioritization:
1. Primary Criterion: Priority Tier (P1_IMMEDIATE > P2_URGENT > P3_ROUTINE > P4_DEFERRED).
2. Secondary Criterion: Remaining Useful Life (RUL ascending — lowest RUL scheduled earliest).
3. Tertiary Criterion: Accumulated Operating Cycles (descending — older spools prioritized).
4. Deterministic Tie-Breaker: Unit Number (ascending engine_id for strict reproducibility).

Assumptions & Capacities:
- Hangar Capacity: Maximum concurrent engine maintenance bays available per slot (configurable).
- Service Lead Time: Minimum buffer cycles required to stage tooling and spare parts.
- Sequential Slots: When high-priority engines exceed bay capacity, subsequent slots are scheduled.
"""

from typing import Any, Dict, List, Optional
from backend.app.core.config import settings

PRIORITY_RANK = {
    "P1_IMMEDIATE": 1,
    "P2_URGENT": 2,
    "P3_ROUTINE": 3,
    "P4_DEFERRED": 4,
}

SCHEDULING_POLICY_DOC = (
    "Deterministic Multi-Criteria Priority Policy: "
    "(1) Priority Tier rank [P1 > P2 > P3 > P4]; "
    "(2) Lowest predicted RUL; "
    "(3) Highest accumulated flight cycles; "
    "(4) Unit ID ascending tie-breaker. "
    "Designed for transparent academic operational planning; not certified aviation dispatch logic."
)


def schedule_fleet_maintenance(
    engines: List[Dict[str, Any]],
    hangar_capacity: Optional[int] = None,
    lead_time_cycles: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Schedules fleet engine maintenance considering operational constraints and bay capacity.
    
    Args:
        engines: List of dicts containing:
            - engine_id (int)
            - predicted_rul (float)
            - current_cycle (int)
            - priority (str: P1_IMMEDIATE, P2_URGENT, P3_ROUTINE, P4_DEFERRED)
            - risk_level (str)
        hangar_capacity: Maximum engines serviced simultaneously per bay slot (default: 2)
        lead_time_cycles: Advance cycles needed before starting maintenance (default: 5)
        
    Returns:
        Structured schedule with slot numbers, cycle targets, and capacity utilization.
    """
    capacity = hangar_capacity if hangar_capacity and hangar_capacity > 0 else settings.DEFAULT_HANGAR_CAPACITY
    lead_time = lead_time_cycles if lead_time_cycles is not None else settings.DEFAULT_MAINTENANCE_LEAD_TIME

    if not engines:
        return {
            "total_engines": 0,
            "hangar_capacity": capacity,
            "total_slots": 0,
            "schedule": [],
            "bottleneck_warning": None,
            "tie_breaking_policy": SCHEDULING_POLICY_DOC,
        }

    # Deterministic sorting key: (priority_rank, predicted_rul, -current_cycle, engine_id)
    def sorting_key(item: Dict[str, Any]):
        p_rank = PRIORITY_RANK.get(item.get("priority", "P4_DEFERRED"), 4)
        rul = float(item.get("predicted_rul", 999.0))
        cycles = int(item.get("current_cycle", 0))
        e_id = int(item.get("engine_id", 0))
        return (p_rank, rul, -cycles, e_id)

    sorted_engines = sorted(engines, key=sorting_key)

    schedule_items = []
    slot_allocations: Dict[int, int] = {}
    current_slot = 1
    bottleneck_detected = False

    for idx, eng in enumerate(sorted_engines):
        e_id = eng["engine_id"]
        rul = float(eng.get("predicted_rul", 0.0))
        cycle = int(eng.get("current_cycle", 1))
        priority = eng.get("priority", "P4_DEFERRED")
        risk = eng.get("risk_level", "HEALTHY")

        # Determine slot based on capacity
        assigned_slot = (idx // capacity) + 1
        slot_allocations[assigned_slot] = slot_allocations.get(assigned_slot, 0) + 1

        # Check for bottleneck: If P1_IMMEDIATE engines are pushed to Slot > 1
        if priority == "P1_IMMEDIATE" and assigned_slot > 1:
            bottleneck_detected = True

        # Calculate scheduled target cycle
        # Target cycle = current_cycle + max(1, rul - (assigned_slot - 1) * lead_time)
        # Engines must enter maintenance before their RUL expires
        buffer = max(1, int(rul - lead_time))
        target_cycle = cycle + max(1, min(buffer, 25))

        rationale = (
            f"Rank #{idx + 1} ({priority}). Scheduled into Slot {assigned_slot} "
            f"({slot_allocations[assigned_slot]}/{capacity} bays). Target maintenance by cycle {target_cycle}."
        )

        schedule_items.append(
            {
                "engine_id": e_id,
                "priority": priority,
                "risk_level": risk,
                "predicted_rul": rul,
                "current_cycle": cycle,
                "slot_number": assigned_slot,
                "scheduled_cycle_target": target_cycle,
                "estimated_downtime_cycles": 5,
                "scheduling_rationale": rationale,
            }
        )

    total_slots = max(slot_allocations.keys()) if slot_allocations else 0
    bottleneck_warning = (
        f"Warning: Immediate critical engines exceed available hangar capacity ({capacity} bays). "
        f"Some P1 engines were deferred to Slot 2+. Consider leasing temporary maintenance bays."
        if bottleneck_detected
        else None
    )

    return {
        "total_engines": len(engines),
        "hangar_capacity": capacity,
        "lead_time_cycles": lead_time,
        "total_slots": total_slots,
        "schedule": schedule_items,
        "bottleneck_warning": bottleneck_warning,
        "tie_breaking_policy": SCHEDULING_POLICY_DOC,
    }
