"""
Comprehensive Unit and Integration Tests for Phase 4:
- Risk Categorization and Prototype Disclaimers
- Maintenance Priority Recommendations (P1-P4, Human Review Flag)
- Gradient-Based Feature Attribution & Sensor Explainability
- Deterministic Fleet Maintenance Scheduler (Capacity & Tie-Breaking)
- Maintenance Work Orders CRUD (Supabase / In-Memory Repository)
- API Endpoints: /maintenance/schedule, /maintenance/records, and Phase 4 /predict payload
"""

from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import settings
from backend.app.db.repository import prediction_repo
from backend.app.main import app
from backend.app.ml.explainer import ModelExplainer
from backend.app.ml.risk import determine_risk_category, generate_maintenance_recommendation
from backend.app.ml.scheduler import schedule_fleet_maintenance
from backend.app.ml.preprocessor import DEFAULT_FEATURE_COLUMNS


@pytest.fixture(scope="module")
def client():
    """Initializes TestClient triggering FastAPI lifespan setup (loading model into memory)."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def clean_memory_db():
    """Resets in-memory prediction and maintenance stores before each test."""
    prediction_repo.clear_in_memory()
    yield
    prediction_repo.clear_in_memory()


@pytest.fixture
def sample_engines_data():
    """Sample engine telemetry summaries for fleet scheduling test."""
    return [
        {"engine_id": 10, "predicted_rul": 15.2, "current_cycle": 180, "priority": "P1_IMMEDIATE", "risk_level": "CRITICAL"},
        {"engine_id": 2, "predicted_rul": 12.0, "current_cycle": 150, "priority": "P1_IMMEDIATE", "risk_level": "CRITICAL"},
        {"engine_id": 5, "predicted_rul": 38.5, "current_cycle": 130, "priority": "P2_URGENT", "risk_level": "WARNING"},
        {"engine_id": 8, "predicted_rul": 65.0, "current_cycle": 110, "priority": "P3_ROUTINE", "risk_level": "MODERATE"},
        {"engine_id": 1, "predicted_rul": 110.0, "current_cycle": 90, "priority": "P4_DEFERRED", "risk_level": "HEALTHY"},
    ]


# ====================================================================
# Test 1: Configurable Risk Categories & Prototype Disclaimers
# ====================================================================
def test_risk_category_thresholds():
    """Verifies that RUL correctly maps to prototype risk categories and includes required disclaimers."""
    # Critical: RUL <= 25.0
    crit = determine_risk_category(20.0)
    assert crit["level"] == "CRITICAL"
    assert crit["priority"] == "P1_IMMEDIATE"
    assert crit["is_prototype_rule"] is True
    assert "PROTOTYPE" in crit["disclaimer"].upper()
    assert "NOT A CERTIFIED" in crit["disclaimer"].upper()

    # Warning: 25.0 < RUL <= 50.0
    warn = determine_risk_category(35.0)
    assert warn["level"] == "WARNING"
    assert warn["priority"] == "P2_URGENT"

    # Moderate: 50.0 < RUL <= 80.0
    mod = determine_risk_category(65.0)
    assert mod["level"] == "MODERATE"
    assert mod["priority"] == "P3_ROUTINE"

    # Healthy: RUL > 80.0
    healthy = determine_risk_category(105.0)
    assert healthy["level"] == "HEALTHY"
    assert healthy["priority"] == "P4_DEFERRED"


def test_custom_risk_thresholds():
    """Verifies configurable thresholds can be passed dynamically."""
    res = determine_risk_category(
        15.0,
        critical_threshold=10.0,
        warning_threshold=30.0,
        moderate_threshold=60.0,
    )
    assert res["level"] == "WARNING"  # 15.0 is above custom critical (10) but below warning (30)


# ====================================================================
# Test 2: Maintenance Recommendation Logic & Mandatory Human Review
# ====================================================================
def test_maintenance_recommendations():
    """Verifies actionable engineering recommendations enforce mandatory certified human review."""
    p1 = generate_maintenance_recommendation(
        predicted_rul=15.0,
        risk_level="CRITICAL",
        engine_id=1,
        current_cycle=120,
    )
    assert p1["priority"] == "P1_IMMEDIATE"
    assert p1["human_review_required"] is True
    assert "borescope" in p1["action"].lower() or "overhaul" in p1["action"].lower()
    assert "p1_immediate" in p1["policy_rule"].lower()

    p4 = generate_maintenance_recommendation(
        predicted_rul=120.0,
        risk_level="HEALTHY",
        engine_id=2,
        current_cycle=80,
    )
    assert p4["priority"] == "P4_DEFERRED"
    assert p4["human_review_required"] is True
    assert "p4_deferred" in p4["policy_rule"].lower()


# ====================================================================
# Test 3: Deterministic Fleet Scheduling & Tie-Breaking
# ====================================================================
def test_fleet_scheduler_capacity_and_sorting(sample_engines_data):
    """
    Tests deterministic multi-criteria scheduler:
    - Primary: Priority tier
    - Secondary: Lowest RUL
    - Hangar capacity constraint (e.g. 2 bays per slot)
    """
    result = schedule_fleet_maintenance(
        engines=sample_engines_data,
        hangar_capacity=2,
        lead_time_cycles=5,
    )

    assert result["total_engines"] == 5
    assert result["hangar_capacity"] == 2
    assert result["total_slots"] == 3
    schedule = result["schedule"]

    # Check that Slot 1 contains the two P1 engines (Engine 2 with RUL 12.0 and Engine 10 with RUL 15.2)
    assert schedule[0]["engine_id"] == 2
    assert schedule[0]["slot_number"] == 1
    assert schedule[1]["engine_id"] == 10
    assert schedule[1]["slot_number"] == 1

    # Check that Slot 2 contains Engine 5 (P2) and Engine 8 (P3)
    assert schedule[2]["engine_id"] == 5
    assert schedule[2]["slot_number"] == 2
    assert schedule[3]["engine_id"] == 8
    assert schedule[3]["slot_number"] == 2

    # Check that Slot 3 contains Engine 1 (P4)
    assert schedule[4]["engine_id"] == 1
    assert schedule[4]["slot_number"] == 3


def test_scheduler_tie_breaking():
    """Verifies that engines with identical priority, RUL, and cycles break ties by ascending engine_id."""
    tied_engines = [
        {"engine_id": 42, "predicted_rul": 20.0, "current_cycle": 100, "priority": "P1_IMMEDIATE", "risk_level": "CRITICAL"},
        {"engine_id": 7, "predicted_rul": 20.0, "current_cycle": 100, "priority": "P1_IMMEDIATE", "risk_level": "CRITICAL"},
    ]
    res = schedule_fleet_maintenance(tied_engines, hangar_capacity=1)
    # Unit 7 must come before Unit 42 due to ascending ID tie-breaker
    assert res["schedule"][0]["engine_id"] == 7
    assert res["schedule"][1]["engine_id"] == 42


def test_scheduler_bottleneck_detection():
    """Verifies that when immediate P1 engines exceed bay capacity, a bottleneck alert is raised."""
    p1_fleet = [
        {"engine_id": 1, "predicted_rul": 10.0, "current_cycle": 100, "priority": "P1_IMMEDIATE", "risk_level": "CRITICAL"},
        {"engine_id": 2, "predicted_rul": 15.0, "current_cycle": 100, "priority": "P1_IMMEDIATE", "risk_level": "CRITICAL"},
        {"engine_id": 3, "predicted_rul": 20.0, "current_cycle": 100, "priority": "P1_IMMEDIATE", "risk_level": "CRITICAL"},
    ]
    # Capacity is 2 bays, but 3 engines need immediate attention
    res = schedule_fleet_maintenance(p1_fleet, hangar_capacity=2)
    assert res["bottleneck_warning"] is not None
    assert "exceed available hangar capacity" in res["bottleneck_warning"]


# ====================================================================
# Test 4: Gradient Attribution & Explainability
# ====================================================================
def test_model_explainer_attribution(client: TestClient):
    """
    Verifies that ModelExplainer computes real gradient attributions using tf.GradientTape
    and returns valid percentage weights that sum to 100%.
    """
    import numpy as np
    import pandas as pd
    from backend.app.api.health import get_predictor_instance
    from backend.app.ml.sequence import create_test_last_sequences

    predictor = get_predictor_instance()
    assert predictor is not None and predictor.explainer is not None

    # Synthesize realistic 35-cycle telemetry DataFrame
    cycles = 35
    df_data = {
        "unit_number": [1] * cycles,
        "time_cycles": list(range(1, cycles + 1)),
    }
    for col in DEFAULT_FEATURE_COLUMNS:
        df_data[col] = [500.0 + c * 0.2 for c in range(cycles)]
    engine_df = pd.DataFrame(df_data)

    scaled_df = predictor.preprocessor.transform(engine_df)
    X_last, _ = create_test_last_sequences(
        scaled_df, sequence_length=predictor.sequence_length, feature_columns=predictor.feature_columns
    )
    explanation = predictor.explainer.generate_explanation(X_last, engine_df)

    assert "Gradient-Based" in explanation["attribution_method"]
    assert "SHAP" in explanation["method_limitation_note"]
    # Check that attributions sum to ~100%
    attrs = explanation["feature_attributions"]
    total_pct = sum(attrs.values())
    assert abs(total_pct - 100.0) < 1.0  # Allow minor rounding

    # Check top contributing sensors structure
    assert len(explanation["top_contributing_sensors"]) > 0
    top1 = explanation["top_contributing_sensors"][0]
    assert "sensor" in top1
    assert "attribution_percent" in top1
    assert "subsystem" in top1
    assert "trend_direction" in top1


# ====================================================================
# Test 5: Maintenance Records / Work Orders CRUD
# ====================================================================
def test_maintenance_records_crud(client: TestClient):
    """Verifies full lifecycle of maintenance work orders (Create, List, Filter, Get, Patch)."""
    # 1. Create a work order
    create_payload = {
        "engine_id": 99,
        "action_taken": "High Pressure Turbine borescope inspection and seal replacement.",
        "technician_id": "TECH-882",
        "scheduled_cycle": 150,
        "status": "PENDING",
        "notes": "Triggered by P1 critical degradation alert.",
    }
    create_res = client.post("/maintenance/records", json=create_payload)
    assert create_res.status_code == 201
    created_data = create_res.json()
    record_id = created_data["id"]
    assert created_data["engine_id"] == 99
    assert created_data["status"] == "PENDING"
    assert "created_at" in created_data

    # 2. Get by ID
    get_res = client.get(f"/maintenance/records/{record_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == record_id

    # 3. List and filter by engine_id
    list_res = client.get("/maintenance/records?engine_id=99")
    assert list_res.status_code == 200
    records = list_res.json()
    assert len(records) >= 1
    assert any(r["id"] == record_id for r in records)

    # 4. Patch status to COMPLETED
    patch_payload = {
        "status": "COMPLETED",
        "notes": "Inspection completed successfully. No internal blade cracking detected.",
    }
    patch_res = client.patch(f"/maintenance/records/{record_id}", json=patch_payload)
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["status"] == "COMPLETED"
    assert "Inspection completed successfully" in updated["notes"]


# ====================================================================
# Test 6: Schedule API Endpoint
# ====================================================================
def test_api_schedule_endpoint(client: TestClient, sample_engines_data):
    """Verifies POST /maintenance/schedule endpoint."""
    req_body = {
        "hangar_capacity": 3,
        "lead_time_cycles": 5,
        "engines": sample_engines_data,
    }
    res = client.post("/maintenance/schedule", json=req_body)
    assert res.status_code == 200
    data = res.json()
    assert data["hangar_capacity"] == 3
    assert data["total_engines"] == 5
    assert len(data["schedule"]) == 5
    assert data["tie_breaking_policy"] is not None


# ====================================================================
# Test 7: Integration in /predict endpoint for Phase 4 fields
# ====================================================================
def test_predict_includes_phase4_fields(client: TestClient):
    """Verifies that /predict responses contain Phase 4 risk, recommendation, explanation, and fleet schedule."""
    raw_path = Path("backend/data/raw/test_FD001.txt")
    if not raw_path.exists():
        pytest.skip("Test telemetry dataset not found")

    lines = []
    with open(raw_path, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split()
            if parts and parts[0] == "1":
                lines.append(line)
            elif lines:
                break
    csv_bytes = "".join(lines).encode("utf-8")

    files = {"file": ("engine_1.csv", csv_bytes, "text/csv")}
    response = client.post("/predict", files=files)
    assert response.status_code == 200
    data = response.json()

    # Check top-level fleet schedule
    assert "fleet_schedule" in data
    assert data["fleet_schedule"]["total_engines"] == 1

    # Check engine-level Phase 4 fields
    engine = data["predictions"][0]
    assert "priority" in engine
    assert "risk_assessment" in engine
    assert "maintenance_recommendation" in engine
    assert "explanation" in engine

    assert engine["risk_assessment"]["is_prototype_rule"] is True
    assert engine["maintenance_recommendation"]["human_review_required"] is True
    assert len(engine["explanation"]["top_contributing_sensors"]) > 0
