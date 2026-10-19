"""
API Router Aggregator.
Mounts health and prediction endpoints under /api/v1 and provides convenient root-level aliases.
"""

from fastapi import APIRouter
from backend.app.api.health import router as health_router
from backend.app.api.predictions import router as predictions_router
from backend.app.api.maintenance import router as maintenance_router

api_router = APIRouter()

# Include sub-routers
api_router.include_router(health_router)
api_router.include_router(predictions_router)
api_router.include_router(maintenance_router)
