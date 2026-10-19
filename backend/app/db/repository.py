"""
Prediction Repository supporting both Supabase Cloud Storage and In-Memory Fallback.
Provides unified CRUD operations for inference records and query pagination.
"""

from datetime import datetime, timezone
import logging
from threading import Lock
from typing import Any, Dict, List, Optional, Tuple
import uuid

from backend.app.db.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


class PredictionRepository:
    """Data Access Object for engine RUL predictions."""

    def __init__(self):
        self._memory_store: List[Dict[str, Any]] = []
        self._maintenance_store: List[Dict[str, Any]] = []
        self._lock = Lock()

    def save_predictions(self, records: List[Dict[str, Any]]) -> List[str]:
        """
        Persists a list of prediction records to Supabase.
        Falls back to thread-safe in-memory store if Supabase is offline or unconfigured.
        """
        if not records:
            return []

        # Ensure all records have ID and ISO timestamp
        prepared_records = []
        for r in records:
            item = dict(r)
            if "id" not in item or not item["id"]:
                item["id"] = str(uuid.uuid4())
            if "created_at" not in item or not item["created_at"]:
                item["created_at"] = datetime.now(timezone.utc).isoformat()
            prepared_records.append(item)

        client = get_supabase_client()
        if client is not None:
            try:
                # Attempt insertion to Supabase 'predictions' table
                response = client.table("predictions").insert(prepared_records).execute()
                inserted_ids = [row["id"] for row in response.data] if response.data else [r["id"] for r in prepared_records]
                logger.info("Successfully persisted %d predictions to Supabase.", len(inserted_ids))
                return inserted_ids
            except Exception as exc:
                logger.warning(
                    "Supabase insert failed (%s). Storing records in in-memory fallback.",
                    str(exc),
                )
                # Fall back to in-memory store below

        # In-memory storage fallback
        with self._lock:
            for item in prepared_records:
                self._memory_store.insert(0, item)  # prepend to keep newest first

        logger.info("Persisted %d predictions in memory store.", len(prepared_records))
        return [r["id"] for r in prepared_records]

    def get_predictions(
        self,
        page: int = 1,
        page_size: int = 20,
        engine_id: Optional[int] = None,
        risk_level: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Retrieves paginated prediction records with optional engine_id and risk_level filters.
        Returns: (items, total_count)
        """
        client = get_supabase_client()
        if client is not None:
            try:
                query = client.table("predictions").select("*", count="exact")
                if engine_id is not None:
                    query = query.eq("engine_id", engine_id)
                if risk_level is not None:
                    query = query.eq("risk_level", risk_level.upper())

                start = (page - 1) * page_size
                end = start + page_size - 1
                query = query.order("created_at", desc=True).range(start, end)
                response = query.execute()

                items = response.data or []
                total = response.count if response.count is not None else len(items)
                return items, total
            except Exception as exc:
                logger.warning(
                    "Supabase query failed (%s). Reading from in-memory fallback.",
                    str(exc),
                )

        # In-memory pagination and filtering
        with self._lock:
            filtered = self._memory_store
            if engine_id is not None:
                filtered = [r for r in filtered if r.get("engine_id") == engine_id]
            if risk_level is not None:
                filtered = [r for r in filtered if r.get("risk_level", "").upper() == risk_level.upper()]

            total = len(filtered)
            start = (page - 1) * page_size
            end = start + page_size
            items = filtered[start:end]

        return items, total

    def get_prediction_by_id(self, prediction_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a single prediction record by UUID identifier."""
        client = get_supabase_client()
        if client is not None:
            try:
                response = client.table("predictions").select("*").eq("id", prediction_id).limit(1).execute()
                if response.data:
                    return response.data[0]
            except Exception as exc:
                logger.warning("Supabase get_by_id failed (%s). Checking in-memory store.", str(exc))

        with self._lock:
            for r in self._memory_store:
                if str(r.get("id")) == str(prediction_id):
                    return r
        return None

    def create_maintenance_record(self, record: Dict[str, Any]) -> str:
        """Persists a new maintenance work order record to Supabase or in-memory fallback."""
        item = dict(record)
        if "id" not in item or not item["id"]:
            item["id"] = str(uuid.uuid4())
        if "created_at" not in item or not item["created_at"]:
            item["created_at"] = datetime.now(timezone.utc).isoformat()
        if "status" not in item:
            item["status"] = "PENDING"

        client = get_supabase_client()
        if client is not None:
            try:
                response = client.table("maintenance_records").insert(item).execute()
                if response.data:
                    return response.data[0]["id"]
            except Exception as exc:
                logger.warning("Supabase maintenance_records insert failed (%s). Falling back.", str(exc))

        with self._lock:
            self._maintenance_store.insert(0, item)
        return item["id"]

    def get_maintenance_records(
        self,
        engine_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieves maintenance records filtered by engine_id and/or status."""
        client = get_supabase_client()
        if client is not None:
            try:
                query = client.table("maintenance_records").select("*")
                if engine_id is not None:
                    query = query.eq("engine_id", engine_id)
                if status is not None:
                    query = query.eq("status", status.upper())
                response = query.order("created_at", desc=True).execute()
                return response.data or []
            except Exception as exc:
                logger.warning("Supabase maintenance_records query failed (%s). Reading from memory.", str(exc))

        with self._lock:
            filtered = list(self._maintenance_store)
            if engine_id is not None:
                filtered = [r for r in filtered if r.get("engine_id") == engine_id]
            if status is not None:
                filtered = [r for r in filtered if r.get("status", "").upper() == status.upper()]
            return filtered

    def get_maintenance_record_by_id(self, record_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a single maintenance record by UUID identifier."""
        client = get_supabase_client()
        if client is not None:
            try:
                response = client.table("maintenance_records").select("*").eq("id", record_id).limit(1).execute()
                if response.data:
                    return response.data[0]
            except Exception as exc:
                logger.warning("Supabase maintenance_record get failed (%s). Checking memory.", str(exc))

        with self._lock:
            for r in self._maintenance_store:
                if str(r.get("id")) == str(record_id):
                    return r
        return None

    def update_maintenance_record(self, record_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Updates fields (e.g. status, notes, action_taken) of a maintenance record."""
        client = get_supabase_client()
        if client is not None:
            try:
                response = client.table("maintenance_records").update(updates).eq("id", record_id).execute()
                if response.data:
                    return response.data[0]
            except Exception as exc:
                logger.warning("Supabase maintenance_records update failed (%s). Updating in memory.", str(exc))

        with self._lock:
            for r in self._maintenance_store:
                if str(r.get("id")) == str(record_id):
                    r.update(updates)
                    return dict(r)
        return None

    def clear_in_memory(self) -> None:
        """Utility for test suite cleanup."""
        with self._lock:
            self._memory_store.clear()
            self._maintenance_store.clear()


# Global repository instance
prediction_repo = PredictionRepository()
