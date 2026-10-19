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
    summary="Health check and ML model readiness",
    description="Reports the operational status of the API, ML model in-memory state, and Supabase connectivity.",
)
async def check_health() -> HealthResponse:
    global _predictor
    model_loaded = _predictor is not None and _predictor._is_loaded
    scaler_loaded = _predictor is not None and _predictor.preprocessor is not None
    db_connected = is_supabase_connected()

    features_count = len(_predictor.feature_columns) if _predictor else 14
    seq_len = _predictor.sequence_length if _predictor else 30

    status = "healthy" if model_loaded and scaler_loaded else "degraded"
    db_type = "supabase" if db_connected else "in-memory-fallback"

    return HealthResponse(
        status=status,
        model_loaded=model_loaded,
        scaler_loaded=scaler_loaded,
        model_version=settings.MODEL_VERSION,
        features_count=features_count,
        sequence_length=seq_len,
        database_connected=db_connected,
        database_type=db_type,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
