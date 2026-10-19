"""
Integration and Unit Tests for FastAPI Prediction Service (Phase 2).
Tests:
- GET /health and model readiness
- POST /predict with valid CSV data and real LSTM inference
- Missing required sensor columns (HTTP 422)
- Non-numeric and invalid data handling (HTTP 422)
- Short sequence padding (< 30 cycles)
- Multi-engine CSV parsing & fleet aggregation
- Paginated prediction history (GET /predictions)
- Specific prediction record retrieval (GET /predictions/{id})
- Database resilience and error handling
"""

import io
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import settings
from backend.app.db.repository import prediction_repo
from backend.app.main import app
from backend.app.ml.preprocessor import DEFAULT_FEATURE_COLUMNS


@pytest.fixture(scope="module")
def client():
    """Initializes TestClient triggering FastAPI lifespan setup (loading model into memory)."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def clean_memory_db():
    """Resets in-memory prediction storage before each test."""
    prediction_repo.clear_in_memory()
    yield
    prediction_repo.clear_in_memory()


@pytest.fixture
def valid_csv_bytes() -> bytes:
    """Creates a valid single-engine CSV matching C-MAPSS requirements."""
    raw_path = Path("backend/data/raw/test_FD001.txt")
    if raw_path.exists():
        # Extract cycles for Engine #1 only
        lines = []
        with open(raw_path, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split()
                if parts and parts[0] == "1":
                    lines.append(line)
                elif lines:
                    break
        return "".join(lines).encode("utf-8")


    # Fallback synthetic CSV
    header = "unit_number,time_cycles,setting_1,setting_2,setting_3," + ",".join(DEFAULT_FEATURE_COLUMNS) + "\n"
    rows = []
    for c in range(1, 41):
        sensor_vals = [str(500.0 + i * 10.0 + c * 0.1) for i in range(len(DEFAULT_FEATURE_COLUMNS))]
        row = f"1,{c},0.0,0.0,100.0," + ",".join(sensor_vals)
        rows.append(row)
    return (header + "\n".join(rows)).encode("utf-8")


@pytest.fixture
def multi_engine_csv_bytes() -> bytes:
    """Creates a multi-engine CSV containing 35 cycles for Engine #1 and 35 cycles for Engine #2."""
    header = "unit_number,time_cycles,setting_1,setting_2,setting_3," + ",".join(DEFAULT_FEATURE_COLUMNS) + "\n"
    rows = []
    for engine_id in [1, 2]:
        for c in range(1, 36):
            sensor_vals = [str(500.0 + i * 10.0 + (c + engine_id * 5) * 0.1) for i in range(len(DEFAULT_FEATURE_COLUMNS))]
            row = f"{engine_id},{c},0.0,0.0,100.0," + ",".join(sensor_vals)
            rows.append(row)
    return (header + "\n".join(rows)).encode("utf-8")


# ====================================================================
# Test 1: Health Check & Model Readiness
# ====================================================================
def test_health_endpoint(client: TestClient):
    """Verifies GET /health returns operational readiness and memory resident model."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True
    assert data["scaler_loaded"] is True
    assert data["features_count"] == 14
    assert data["sequence_length"] == 30
    assert "timestamp" in data


# ====================================================================
# Test 2: Valid CSV Upload with Real Inference
# ====================================================================
def test_predict_valid_csv(client: TestClient, valid_csv_bytes: bytes):
    """Verifies POST /predict processes real CSV sensor data and returns RUL."""
    files = {"file": ("engine_test.csv", valid_csv_bytes, "text/csv")}
    response = client.post("/predict", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "fleet_summary" in data
    assert len(data["predictions"]) == 1

    engine_pred = data["predictions"][0]
    assert engine_pred["engine_id"] == 1
    assert engine_pred["predicted_rul"] >= 0.0
    assert engine_pred["risk_level"] in ["CRITICAL", "WARNING", "MODERATE", "HEALTHY"]
    assert engine_pred["database_id"] is not None
    assert len(engine_pred["trajectory"]) > 0


# ====================================================================
# Test 3: Raw CSV String JSON Endpoint
# ====================================================================
def test_predict_raw_csv_endpoint(client: TestClient, valid_csv_bytes: bytes):
    """Verifies POST /predict/raw works for programmatic payload strings."""
    payload = {"csv_data": valid_csv_bytes.decode("utf-8"), "include_trajectory": True}
    response = client.post("/predict/raw", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["fleet_summary"]["total_engines"] == 1
    assert data["predictions"][0]["predicted_rul"] > 0


# ====================================================================
# Test 4: Missing Required Sensor Columns (HTTP 422)
# ====================================================================
def test_predict_missing_sensor_columns(client: TestClient):
    """Verifies that omitting a required sensor channel returns descriptive HTTP 422."""
    bad_csv = "unit_number,time_cycles,setting_1,sensor_2,sensor_3\n1,1,0.0,642.0,1580.0\n"
    files = {"file": ("bad_sensors.csv", bad_csv.encode("utf-8"), "text/csv")}
    response = client.post("/predict", files=files)

    assert response.status_code == 422
    data = response.json()
    assert "Missing" in data["detail"]
    assert "sensor_4" in data["detail"]


# ====================================================================
# Test 5: Invalid Non-Numeric Telemetry Data (HTTP 422)
# ====================================================================
def test_predict_non_numeric_data(client: TestClient):
    """Verifies that non-numeric characters in sensor measurements return HTTP 422."""
    header = "unit_number,time_cycles,setting_1,setting_2,setting_3," + ",".join(DEFAULT_FEATURE_COLUMNS) + "\n"
    row = "1,1,0.0,0.0,100.0," + ",".join(["CORRUPT" if i == 0 else "500.0" for i in range(len(DEFAULT_FEATURE_COLUMNS))])
    bad_csv = (header + row).encode("utf-8")

    files = {"file": ("corrupt.csv", bad_csv, "text/csv")}
    response = client.post("/predict", files=files)

    assert response.status_code == 422
    assert "non-numeric" in response.json()["detail"].lower()


# ====================================================================
# Test 6: Insufficient Sequence Length (< 30 cycles padded safely)
# ====================================================================
def test_predict_short_sequence_padding(client: TestClient):
    """Verifies that an engine with only 8 cycles is front-padded and predicted safely."""
    header = "unit_number,time_cycles,setting_1,setting_2,setting_3," + ",".join(DEFAULT_FEATURE_COLUMNS) + "\n"
    rows = []
    for c in range(1, 9):  # Only 8 cycles
        sensor_vals = [str(500.0 + i * 10.0 + c * 0.1) for i in range(len(DEFAULT_FEATURE_COLUMNS))]
        rows.append(f"1,{c},0.0,0.0,100.0," + ",".join(sensor_vals))
    short_csv = (header + "\n".join(rows)).encode("utf-8")

    files = {"file": ("short_engine.csv", short_csv, "text/csv")}
    response = client.post("/predict", files=files)

    assert response.status_code == 200
    data = response.json()
    engine_pred = data["predictions"][0]
    assert engine_pred["padded_sequence"] is True
    assert engine_pred["cycles_analyzed"] == 8
    assert engine_pred["predicted_rul"] > 0


# ====================================================================
# Test 7: Multi-Engine CSV Parsing & Aggregated Fleet Summary
# ====================================================================
def test_predict_multi_engine_csv(client: TestClient, multi_engine_csv_bytes: bytes):
    """Verifies parsing multiple engines in a single CSV and aggregating fleet metrics."""
    files = {"file": ("multi_engines.csv", multi_engine_csv_bytes, "text/csv")}
    response = client.post("/predict", files=files)

    assert response.status_code == 200
    data = response.json()
    summary = data["fleet_summary"]
    assert summary["total_engines"] == 2
    assert len(data["predictions"]) == 2
    assert {p["engine_id"] for p in data["predictions"]} == {1, 2}
    assert summary["min_rul"] <= summary["avg_rul"]


# ====================================================================
# Test 8: Prediction History Pagination & Retrieval (GET /predictions)
# ====================================================================
def test_get_prediction_history(client: TestClient, valid_csv_bytes: bytes):
    """Verifies storing predictions and retrieving them with pagination and filters."""
    # 1. Post a prediction to populate database
    files = {"file": ("engine_test.csv", valid_csv_bytes, "text/csv")}
    post_res = client.post("/predict", files=files)
    assert post_res.status_code == 200
    created_id = post_res.json()["predictions"][0]["database_id"]

    # 2. Query prediction history
    get_res = client.get("/predictions?page=1&page_size=10")
    assert get_res.status_code == 200
    history = get_res.json()
    assert history["total"] >= 1
    assert len(history["items"]) >= 1
    assert any(item["id"] == created_id for item in history["items"])

    # 3. Query specific prediction by ID
    single_res = client.get(f"/predictions/{created_id}")
    assert single_res.status_code == 200
    single_record = single_res.json()
    assert single_record["id"] == created_id
    assert single_record["engine_id"] == 1
    assert single_record["predicted_rul"] > 0


# ====================================================================
# Test 9: Non-Existent Prediction ID Returns HTTP 404
# ====================================================================
def test_get_nonexistent_prediction_id(client: TestClient):
    """Verifies that an unknown UUID returns HTTP 404 Not Found."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = client.get(f"/predictions/{fake_id}")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
