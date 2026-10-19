"""
Main FastAPI Application Entry Point for NASA C-MAPSS Predictive Maintenance.
Initializes application lifecycle, loads trained ML artifacts into memory,
configures CORS middleware, and mounts API route endpoints.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging
from typing import AsyncGenerator
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.api.health import set_predictor_instance
from backend.app.api.router import api_router
from backend.app.core.config import settings
from backend.app.core.logging import setup_logging
from backend.app.db.supabase_client import get_supabase_client
from backend.app.ml.predictor import CMapssPredictor

setup_logging(settings.DEBUG)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan manager.
    Pre-loads the trained LSTM model and scaler on startup to eliminate cold starts.
    """
    logger.info("Initializing NASA C-MAPSS Predictive Maintenance Backend...")

    # 1. Initialize ML Predictor
    try:
        predictor = CMapssPredictor(artifacts_dir=settings.ARTIFACTS_DIR)
        predictor.load()
        set_predictor_instance(predictor)
        logger.info(
            "ML Engine ready: LSTM model & Scaler resident in memory (%d features).",
            len(predictor.feature_columns),
        )
    except Exception as exc:
        logger.critical(
            "STARTUP FAILURE — ML artifacts could not be loaded: %s. "
            "All /predict calls will be rejected with HTTP 503 until artifacts are restored.",
            str(exc),
            exc_info=True,
        )

    # 2. Check Supabase Connectivity
    client = get_supabase_client()
    if client:
        logger.info("Supabase database client connected.")
    else:
        logger.info("Operating in-memory repository mode.")

    logger.info("FastAPI application startup complete. Swagger UI ready at /docs")
    yield

    logger.info("Shutting down NASA C-MAPSS Backend...")


# Create FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Academic decision-support backend for Turbofan Engine Remaining Useful Life (RUL) "
        "estimation based on NASA C-MAPSS FD001 sensor telemetry and LSTM deep learning."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Configure CORS — explicit development origins only.
# Never allow the wildcard origin alongside allow_credentials=True,
# as browsers reject credentialed cross-origin requests with origin=*.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)

# Mount routes under both / and /api/v1 for maximum client compatibility
app.include_router(api_router)
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    """Catches domain and validation errors and returns 422 Unprocessable Entity."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation Error",
            "detail": str(exc),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handles unexpected server errors gracefully without leaking internals."""
    logger.error("Unhandled internal server exception: %s", str(exc), exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "detail": "An internal server error occurred while processing the telemetry data.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
