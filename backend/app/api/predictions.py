"""
Prediction Endpoints for NASA C-MAPSS Engine Degradation Inference.
Provides:
- POST /predict: Multipart CSV file upload with real LSTM inference.
- POST /predict/raw: Direct CSV string payload for programmatic testing.
- GET /predictions: Paginated prediction history from Supabase / fallback.
- GET /predictions/{prediction_id}: Specific prediction record retrieval.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status

from backend.app.api.health import get_predictor_instance
from backend.app.core.config import settings
from backend.app.db.repository import prediction_repo
from backend.app.ml.validator import parse_and_validate_csv
from backend.app.schemas.prediction import (
    CyclePrediction,
    EnginePrediction,
    FleetSummary,
    PaginatedPredictions,
    PredictionRecord,
    PredictionResponse,
    RawCsvRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Predictions"])


def _run_inference_on_engines(
    engines_data: Dict[int, Any],
    include_trajectory: bool = True,
) -> PredictionResponse:
    """Core pipeline executing ML inference, risk classification, and database persistence."""
    predictor = get_predictor_instance()
    if predictor is None or not predictor._is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Machine learning model is not yet loaded in memory.",
        )

    predictions_list: List[EnginePrediction] = []
    db_records_to_insert: List[Dict[str, Any]] = []

    for engine_id, engine_df in engines_data.items():
        # Real LSTM model inference (Rule 9: never mock in place of real ML)
        pred_dict = predictor.predict_engine(engine_df)

        trajectory_points: Optional[List[CyclePrediction]] = None
        if include_trajectory:
            traj_data = predictor.predict_trajectory(engine_df)
            trajectory_points = [
                CyclePrediction(
                    cycle=item["cycle"],
                    predicted_rul=item["predicted_rul"],
                    risk_level=item["risk_level"],
                )
                for item in traj_data
            ]

        engine_pred = EnginePrediction(
            engine_id=engine_id,
            current_cycle=pred_dict["current_cycle"],
            cycles_analyzed=pred_dict["cycles_analyzed"],
            predicted_rul=pred_dict["predicted_rul"],
            risk_level=pred_dict["risk_level"],
            risk_color=pred_dict["risk_color"],
            recommendation=pred_dict["recommendation"],
            padded_sequence=pred_dict["padded_sequence"],
            trajectory=trajectory_points,
        )
        predictions_list.append(engine_pred)

        # Prepare database record for Supabase
        db_records_to_insert.append(
            {
                "engine_id": engine_id,
                "current_cycle": pred_dict["current_cycle"],
                "cycles_analyzed": pred_dict["cycles_analyzed"],
                "predicted_rul": pred_dict["predicted_rul"],
                "risk_level": pred_dict["risk_level"],
                "risk_color": pred_dict["risk_color"],
                "recommendation": pred_dict["recommendation"],
                "model_version": settings.MODEL_VERSION,
                "features_used": pred_dict["features_used"],
                "input_metadata": {
                    "padded_sequence": pred_dict["padded_sequence"],
                    "sequence_length": pred_dict["sequence_length_used"],
                },
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    # Persist predictions to database (Supabase with in-memory fallback)
    inserted_ids = prediction_repo.save_predictions(db_records_to_insert)
    for idx, pid in enumerate(inserted_ids):
        if idx < len(predictions_list):
            predictions_list[idx].database_id = pid

    # Compute fleet-level summary metrics
    total_engines = len(predictions_list)
    ruls = [p.predicted_rul for p in predictions_list]
    min_rul = min(ruls)
    avg_rul = round(sum(ruls) / total_engines, 1)

    crit_count = sum(1 for p in predictions_list if p.risk_level == "CRITICAL")
    warn_count = sum(1 for p in predictions_list if p.risk_level == "WARNING")
    mod_count = sum(1 for p in predictions_list if p.risk_level == "MODERATE")
    health_count = sum(1 for p in predictions_list if p.risk_level == "HEALTHY")

    # Find highest risk engine (lowest RUL)
    highest_risk_engine = min(predictions_list, key=lambda p: p.predicted_rul).engine_id

    summary = FleetSummary(
        total_engines=total_engines,
        critical_count=crit_count,
        warning_count=warn_count,
        moderate_count=mod_count,
        healthy_count=health_count,
        min_rul=min_rul,
        avg_rul=avg_rul,
        highest_risk_engine_id=highest_risk_engine,
    )

    db_status = "saved_to_supabase" if settings.SUPABASE_URL else "saved_in_memory"

    return PredictionResponse(
        success=True,
        message=f"Successfully generated RUL predictions for {total_engines} engine(s).",
        fleet_summary=summary,
        predictions=predictions_list,
        model_version=settings.MODEL_VERSION,
        features_used=predictor.feature_columns,
        timestamp=datetime.now(timezone.utc).isoformat(),
        database_status=db_status,
    )


@router.post(
    "/predict",
    response_model=PredictionResponse,
    summary="Upload CSV and predict engine Remaining Useful Life (RUL)",
    description=(
        "Accepts a CSV containing turbofan engine sensor data. "
        "Validates required sensor columns and cycle continuity, "
        "executes real LSTM inference, and persists results to the database."
    ),
)
async def predict_from_csv(
    file: UploadFile = File(..., description="CSV file containing engine cycle readings"),
    include_trajectory: bool = Query(True, description="Whether to include historical cycle trajectory"),
) -> PredictionResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename cannot be empty.")

    try:
        content = await file.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {str(exc)}")

    if len(content) > settings.MAX_UPLOAD_BYTES:
        limit_mb = settings.MAX_UPLOAD_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"Uploaded file is too large. Maximum allowed size is {limit_mb} MB.",
        )

    predictor = get_predictor_instance()
    required_features = predictor.feature_columns if predictor else None

    try:
        engines_data = parse_and_validate_csv(
            content,
            required_features=required_features,
            max_rows=settings.MAX_CSV_ROWS,
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err),
        )

    return _run_inference_on_engines(engines_data, include_trajectory=include_trajectory)


@router.post(
    "/predict/raw",
    response_model=PredictionResponse,
    summary="Predict RUL from raw CSV text payload",
    description="Accepts raw CSV string body. Suitable for programmatic testing and curl requests.",
)
async def predict_from_raw_csv(payload: RawCsvRequest) -> PredictionResponse:
    predictor = get_predictor_instance()
    required_features = predictor.feature_columns if predictor else None

    try:
        engines_data = parse_and_validate_csv(payload.csv_data, required_features=required_features)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err),
        )

    return _run_inference_on_engines(engines_data, include_trajectory=payload.include_trajectory)


@router.get(
    "/predictions",
    response_model=PaginatedPredictions,
    summary="Retrieve paginated prediction history",
    description="Returns stored historical RUL predictions with optional engine_id and risk_level filters.",
)
async def get_predictions(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Records per page"),
    engine_id: Optional[int] = Query(None, description="Filter by engine unit number"),
    risk_level: Optional[str] = Query(None, description="Filter by risk tier (CRITICAL, WARNING, MODERATE, HEALTHY)"),
) -> PaginatedPredictions:
    items_raw, total = prediction_repo.get_predictions(
        page=page, page_size=page_size, engine_id=engine_id, risk_level=risk_level
    )

    items = [
        PredictionRecord(
            id=str(r["id"]),
            engine_id=int(r["engine_id"]),
            current_cycle=int(r["current_cycle"]),
            cycles_analyzed=int(r.get("cycles_analyzed", 0)),
            predicted_rul=float(r["predicted_rul"]),
            risk_level=str(r["risk_level"]),
            risk_color=r.get("risk_color"),
            recommendation=r.get("recommendation"),
            model_version=str(r.get("model_version", settings.MODEL_VERSION)),
            features_used=r.get("features_used", []),
            input_metadata=r.get("input_metadata", {}),
            created_at=str(r.get("created_at", "")),
        )
        for r in items_raw
    ]

    total_pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedPredictions(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/predictions/{prediction_id}",
    response_model=PredictionRecord,
    summary="Get a specific prediction by record ID",
    description="Retrieves full metadata and advisory details for a single saved prediction.",
)
async def get_prediction_by_id(prediction_id: str) -> PredictionRecord:
    record = prediction_repo.get_prediction_by_id(prediction_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prediction record with ID '{prediction_id}' was not found.",
        )

    return PredictionRecord(
        id=str(record["id"]),
        engine_id=int(record["engine_id"]),
        current_cycle=int(record["current_cycle"]),
        cycles_analyzed=int(record.get("cycles_analyzed", 0)),
        predicted_rul=float(record["predicted_rul"]),
        risk_level=str(record["risk_level"]),
        risk_color=record.get("risk_color"),
        recommendation=record.get("recommendation"),
        model_version=str(record.get("model_version", settings.MODEL_VERSION)),
        features_used=record.get("features_used", []),
        input_metadata=record.get("input_metadata", {}),
        created_at=str(record.get("created_at", "")),
    )
