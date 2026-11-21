"""
Health Check and Readiness Endpoint.
"""

from datetime import datetime, timezone
from fastapi import APIRouter
from backend.app.core.config import settings
from backend.app.db.supabase_client import is_supabase_connected
from backend.app.ml.predictor import CMapssPredictor
from backend.app.schemas.health import HealthResponse

router = APIRouter(tags=["Health & Status"])

# Predictor instance reference
_predictor: CMapssPredictor | None = None


def set_predictor_instance(predictor: CMapssPredictor) -> None:
    """Sets global predictor reference from application lifespan."""
    global _predictor
    _predictor = predictor


def get_predictor_instance() -> CMapssPredictor | None:
    return _predictor


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check and PINN model readiness",
    description="Reports the operational status of the API, PINN model in-memory state, and database connectivity.",
)
async def check_health() -> HealthResponse:
    global _predictor
    model_loaded = _predictor is not None and _predictor._is_loaded
    scaler_loaded = _predictor is not None and _predictor.preprocessor is not None
    db_connected = is_supabase_connected()

    active_ds = _predictor.active_dataset if _predictor else settings.DEFAULT_DATASET
    features_count = len(_predictor.feature_columns) if _predictor else 14
    seq_len = _predictor.sequence_length if _predictor else 30
    model_version = f"pinn-{active_ds.lower()}-v1.0" if model_loaded else settings.MODEL_VERSION

    status = "healthy" if model_loaded and scaler_loaded else "degraded"
    db_type = "supabase" if db_connected else "in-memory-fallback"

    return HealthResponse(
        status=status,
        model_loaded=model_loaded,
        scaler_loaded=scaler_loaded,
        model_type="PINN",
        model_version=model_version,
        active_dataset=active_ds,
        supported_datasets=list(settings.SUPPORTED_DATASETS),
        features_count=features_count,
        sequence_length=seq_len,
        database_connected=db_connected,
        database_type=db_type,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
