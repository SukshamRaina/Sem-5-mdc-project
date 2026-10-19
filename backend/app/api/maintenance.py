"""
Maintenance Scheduling and Work Orders API (Phase 4).
Provides:
- POST /maintenance/schedule: Compute prioritized slot schedule for engines based on bay capacity.
- GET /maintenance/records: Retrieve maintenance logs/work orders with optional engine and status filters.
- POST /maintenance/records: Create a new maintenance work order.
- GET /maintenance/records/{record_id}: Fetch specific work order details.
- PATCH /maintenance/records/{record_id}: Update status, technician, or notes on a work order.
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from backend.app.db.repository import prediction_repo
from backend.app.ml.scheduler import schedule_fleet_maintenance
from backend.app.schemas.maintenance import (
    FleetScheduleRequest,
    FleetScheduleResponse,
    MaintenanceRecordCreate,
    MaintenanceRecordResponse,
    MaintenanceRecordUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/maintenance", tags=["Maintenance"])


@router.post(
    "/schedule",
    response_model=FleetScheduleResponse,
    summary="Compute Fleet Maintenance Schedule",
    description=(
        "Prioritizes engines using deterministic multi-criteria logic: "
        "(1) Priority tier (P1 > P2 > P3 > P4), (2) Ascending RUL, (3) Descending flight cycles, "
        "(4) Ascending engine ID. Assigns engines to maintenance slots based on configurable hangar bay capacity."
    ),
)
async def compute_fleet_schedule(payload: FleetScheduleRequest) -> FleetScheduleResponse:
    """Computes an optimized schedule for fleet engines."""
    engines_to_schedule = payload.engines

    # If no explicit engine list was supplied in the request body,
    # pull engines from the most recent fleet prediction in the database/in-memory store.
    if engines_to_schedule is None or len(engines_to_schedule) == 0:
        latest_predictions = prediction_repo.get_predictions(limit=1, offset=0)
        if latest_predictions:
            latest = latest_predictions[0]
            metadata = latest.get("input_metadata") or {}
            engines_to_schedule = metadata.get("engines", [])

    schedule_result = schedule_fleet_maintenance(
        engines=engines_to_schedule or [],
        hangar_capacity=payload.hangar_capacity,
        lead_time_cycles=payload.lead_time_cycles,
    )
    return FleetScheduleResponse(**schedule_result)


@router.post(
    "/records",
    response_model=MaintenanceRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Maintenance Record / Work Order",
    description="Logs a new engineering work order or maintenance action into persistent storage.",
)
async def create_maintenance_record(record_in: MaintenanceRecordCreate) -> MaintenanceRecordResponse:
    """Creates a new maintenance record in Supabase or fallback memory store."""
    try:
        record_id = prediction_repo.create_maintenance_record(record_in.model_dump())
        saved_record = prediction_repo.get_maintenance_record_by_id(record_id)
        if not saved_record:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created maintenance record.",
            )
        return MaintenanceRecordResponse(**saved_record)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to create maintenance record: %s", str(exc), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error saving maintenance record: {str(exc)}",
        )


@router.get(
    "/records",
    response_model=List[MaintenanceRecordResponse],
    summary="List Maintenance Records",
    description="Retrieves maintenance logs with optional filters for engine ID and execution status.",
)
async def list_maintenance_records(
    engine_id: Optional[int] = Query(None, description="Filter by specific engine ID"),
    status: Optional[str] = Query(None, description="Filter by status (PENDING, IN_PROGRESS, COMPLETED, CANCELLED)"),
) -> List[MaintenanceRecordResponse]:
    """Lists maintenance work orders ordered by creation date descending."""
    try:
        records = prediction_repo.get_maintenance_records(engine_id=engine_id, status=status)
        return [MaintenanceRecordResponse(**rec) for rec in records]
    except Exception as exc:
        logger.error("Failed to list maintenance records: %s", str(exc), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error querying maintenance records: {str(exc)}",
        )


@router.get(
    "/records/{record_id}",
    response_model=MaintenanceRecordResponse,
    summary="Get Maintenance Record by ID",
)
async def get_maintenance_record(record_id: str) -> MaintenanceRecordResponse:
    """Fetches a specific maintenance record."""
    record = prediction_repo.get_maintenance_record_by_id(record_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Maintenance record '{record_id}' not found.",
        )
    return MaintenanceRecordResponse(**record)


@router.patch(
    "/records/{record_id}",
    response_model=MaintenanceRecordResponse,
    summary="Update Maintenance Record",
    description="Updates maintenance record status, assigned technician, or notes.",
)
async def update_maintenance_record(
    record_id: str,
    update_data: MaintenanceRecordUpdate,
) -> MaintenanceRecordResponse:
    """Updates fields of an existing maintenance record."""
    updates = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not updates:
        existing = prediction_repo.get_maintenance_record_by_id(record_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Maintenance record '{record_id}' not found.",
            )
        return MaintenanceRecordResponse(**existing)

    updated = prediction_repo.update_maintenance_record(record_id, updates)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Maintenance record '{record_id}' not found.",
        )
    return MaintenanceRecordResponse(**updated)
