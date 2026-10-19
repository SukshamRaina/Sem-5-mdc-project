"""
Supabase Client Management for C-MAPSS Predictive Maintenance.
Handles connection pooling, authentication, and graceful degradation
if cloud credentials are not supplied in .env.
"""

import logging
from typing import Optional
from supabase import Client, create_client
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

_supabase_client: Optional[Client] = None
_client_initialized: bool = False


def get_supabase_client() -> Optional[Client]:
    """
    Returns the singleton Supabase client instance if configured.
    Returns None if credentials are missing, allowing in-memory fallback.
    """
    global _supabase_client, _client_initialized

    if _client_initialized:
        return _supabase_client

    url = settings.SUPABASE_URL
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY

    if not url or not key:
        logger.warning(
            "Supabase credentials not found in environment (SUPABASE_URL / SUPABASE_KEY). "
            "Backend will operate seamlessly using high-performance in-memory repository fallback."
        )
        _supabase_client = None
        _client_initialized = True
        return None

    try:
        # Avoid leaking key in logs
        masked_key = key[:6] + "..." + key[-4:] if len(key) > 10 else "***"
        logger.info("Initializing Supabase client with URL: %s (Key: %s)", url, masked_key)
        _supabase_client = create_client(url, key)
        _client_initialized = True
        return _supabase_client
    except Exception as exc:
        logger.error(
            "Failed to initialize Supabase client: %s. Falling back to in-memory storage.",
            str(exc),
        )
        _supabase_client = None
        _client_initialized = True
        return None


def is_supabase_connected() -> bool:
    """Verifies whether Supabase client is active and accessible."""
    client = get_supabase_client()
    return client is not None
