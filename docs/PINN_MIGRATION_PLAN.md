# NASA C-MAPSS PINN Migration Plan

## 1. Executive Summary & Purpose
This document outlines the engineering and scientific plan to migrate the NASA Turbofan Engine Degradation Simulation (C-MAPSS) predictive maintenance system from a purely data-driven Stacked Long Short-Term Memory (LSTM) network to a **Physics-Informed Neural Network (PINN)**.

The system will expand its coverage from the single-condition, single-fault-mode dataset (**FD001**) to all four canonical C-MAPSS subsets (**FD001, FD002, FD003, and FD004**), while preserving end-to-end functionality across the FastAPI backend, Supabase database storage with in-memory fallback, and the React industrial dashboard.

---

## 2. Audit of the Existing Workspace Architecture

A thorough code audit of the current repository identified the following operational flows and integration contracts:

### 1. Sensor Column Selection
- **Implementation**: Defined in `backend/app/ml/preprocessor.py` (`DEFAULT_FEATURE_COLUMNS`) and serialized to `backend/artifacts/feature_columns.json`.
- **Selected Channels (14 sensors)**: `sensor_2`, `sensor_3`, `sensor_4`, `sensor_7`, `sensor_8`, `sensor_9`, `sensor_11`, `sensor_12`, `sensor_13`, `sensor_14`, `sensor_15`, `sensor_17`, `sensor_20`, `sensor_21`.
- **Filtering Rationale**: 10 constant/near-zero variance channels on FD001 are eliminated (`setting_1`, `setting_2`, `setting_3`, `sensor_1`, `sensor_5`, `sensor_6`, `sensor_10`, `sensor_16`, `sensor_18`, `sensor_19`).
- **Limitation**: While valid for FD001, this static selection does not hold for multi-condition datasets (**FD002, FD004**), where operational settings vary across 6 flight conditions and every sensor exhibits non-zero variance.

### 2. RUL Training Label Generation
- **Implementation**: `CMapssPreprocessor.attach_rul_labels(df, clip_upper=True)`.
- **Calculation**: Linear degradation countdown:
  $$\text{RUL}(t) = \max_{c}(t_c) - t$$
- **Piecewise Linear Clipping**: RUL values above `max_rul_clip = 125.0` cycles are clipped to 125.0. This models the physical reality that early in an engine's life cycle, negligible damage accumulates and sensor signatures remain indistinguishable from baseline.
- **Evaluation Rule**: In test sets (`test_FD00X.txt`), trajectories terminate before failure. Ground-truth final RUL is supplied by `RUL_FD00X.txt`, evaluating the final observed cycle of each engine.

### 3. Scaler Fitting and Serialization
- **Implementation**: `sklearn.preprocessing.MinMaxScaler(feature_range=(0.0, 1.0))` within `CMapssPreprocessor`.
- **Strict Anti-Leakage (Rule 6)**: Fitted strictly on the 80 training engine units; validation and test cycles are never observed during normalization.
- **Persistence**: Saved via `joblib.dump` to `backend/artifacts/scaler.joblib`.

### 4. Model Artifact Loading by FastAPI
- **Implementation**: `backend/app/main.py` utilizes the FastAPI `lifespan` context manager.
- **Pre-loading**: Instantiates `CMapssPredictor(artifacts_dir=settings.ARTIFACTS_DIR)` on startup, calls `predictor.load()`, and sets the global singleton reference via `set_predictor_instance(predictor)` to eliminate cold-start latency.

### 5. API Endpoints `/predict` and `/predict/raw`
- **POST `/predict`**: Accepts multipart CSV/TXT file upload, validates file size (10 MB ceiling) and row count (50,000 ceiling), parses with `parse_and_validate_csv`, runs batch inference via `_run_inference_on_engines`, persists to database, and returns `PredictionResponse`.
- **POST `/predict/raw`**: Accepts raw JSON string body `{ csv_data: str, include_trajectory: bool }` for programmatic/CLI testing.
- **Response**: Contains `success`, `message`, `fleet_summary`, `predictions`, `model_version`, `features_used`, `timestamp`, `database_status`, and `fleet_schedule`.

### 6. Multi-Engine Inference
- **Implementation**: `backend/app/ml/validator.py:parse_and_validate_csv`.
- **Mechanism**: Groups telemetry rows by `unit_number`. If `unit_number` is absent, assigns `engine_id = 1`. Infers sequential cycle numbers if missing. Validates strict positivity, absence of duplicates, and absence of non-numeric/infinite values.
- **Aggregation**: `_run_inference_on_engines` computes fleet statistics (`min_rul`, `avg_rul`, risk counts) and generates prioritized maintenance schedules using `schedule_fleet_maintenance`.

### 7. Feature Attribution and Sensor Trends
- **Implementation**: `backend/app/ml/explainer.py:ModelExplainer`.
- **Attribution**: Uses `tf.GradientTape` to compute exact input sensitivity $\nabla_X \widehat{\text{RUL}} = \frac{\partial \widehat{\text{RUL}}}{\partial X}$ across temporal timesteps, normalized to percentage shares summing to 100%.
- **Trends**: Evaluates 1st-degree polynomial regression slope ($\text{units/cycle}$) and Z-score deviation over the recent 30-cycle window to quantify physical sensor drift.
- **Subsystem Mapping**: Maps sensors to physical engine components (`SENSOR_SUBSYSTEM_MAP`).

### 8. Frontend Integration
- **Components**: React industrial dashboard (`frontend/src/App.jsx`).
- **Telemetry Consumption**:
  - `fleet_summary` $\rightarrow$ `FleetSummaryCards.jsx`
  - `predictions` $\rightarrow$ `EngineSelector.jsx`, `EngineRulCard.jsx`, `TrajectoryChart.jsx`, `ExplanationPanel.jsx`
  - `fleet_schedule` $\rightarrow$ `FleetSchedulerCard.jsx`
  - Metadata $\rightarrow$ `SystemHealthCard.jsx`

---

## 3. Dataset Expansion Scope (FD001–FD004)

| Dataset | Operating Conditions | Fault Modes | Train Trajectories | Test Trajectories | Operational Regimes |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **FD001** | 1 (Sea Level) | 1 (HPC Degradation) | 100 engines | 100 engines | Single Regime |
| **FD002** | 6 (Variable Alt/Mach/TRA) | 1 (HPC Degradation) | 260 engines | 259 engines | 6 Regimes |
| **FD003** | 1 (Sea Level) | 2 (HPC + Fan Degradation) | 100 engines | 100 engines | Single Regime |
| **FD004** | 6 (Variable Alt/Mach/TRA) | 2 (HPC + Fan Degradation) | 248 engines | 249 engines | 6 Regimes |

### Dataset Differences & Technical Strategy
1. **Operating Regimes in FD002 & FD004**:
   - The 3 operational settings (`setting_1` Altitude [0–42 kft], `setting_2` Mach [0–0.84], `setting_3` TRA [60 or 100]) cluster into 6 discrete flight conditions.
   - For multi-condition datasets, operating settings cannot be dropped; sensor values are strongly driven by flight conditions.
   - We implement condition-aware preprocessing: preserving setting channels, clustering operating conditions into regime indicators, and fitting dataset-specific scalers.
2. **Failure Modes in FD003 & FD004**:
   - Both High-Pressure Compressor (HPC) wear and Fan assembly wear occur.
   - Sensor selection must retain fan telemetry (`sensor_8` physical fan speed, `sensor_13` corrected fan speed) and HPC telemetry (`sensor_3`, `sensor_7`, `sensor_11`).

---

## 4. PINN Architecture & Mathematical Formulation

### 4.1 Latent Degradation State $D(t)$
- Let $D(t) \in [0, 1]$ represent normalized latent degradation:
  $$D(t=0) \approx 0 \quad (\text{healthy}), \quad D(t_{\text{failure}}) \approx 1 \quad (\text{end-of-life})$$
- Relationship to Remaining Useful Life:
  $$\widehat{\text{RUL}}(t) = RUL_{\max} \cdot (1 - D(t))$$
  where $RUL_{\max} = 125$ cycles.

### 4.2 Governing Degradation Differential Equation
- Mechanical wear in turbomachinery is governed by:
  $$\frac{dD}{dt} = g_\theta(D(t), S(t), U(t))$$
  where $S(t)$ are sensor measurements, $U(t)$ are operating conditions, and $g_\theta \ge 0$ is the learned physical degradation rate function.
- In terms of Remaining Useful Life:
  $$-\frac{\partial \widehat{\text{RUL}}}{\partial t} = RUL_{\max} \cdot g_\theta(S(t), U(t))$$

### 4.3 Physics Residual & Loss Terms
1. **Physics Residual**:
   $$r_{\text{physics}} = -\frac{\partial \widehat{\text{RUL}}}{\partial t} - RUL_{\max} \cdot g_\theta(S(t), U(t))$$
   $$\mathcal{L}_{\text{physics}} = \frac{1}{B} \sum_{i=1}^B r_{\text{physics}, i}^2$$
2. **Monotonicity Constraint (Irreversible Damage)**:
   Since turbofan blade wear and clearance enlargement cannot spontaneously heal during operational flights:
   $$\frac{\partial \widehat{\text{RUL}}}{\partial t} \le 0 \implies \mathcal{L}_{\text{monotonicity}} = \frac{1}{B} \sum_{i=1}^B \left( \max\left(0, \frac{\partial \widehat{\text{RUL}}_i}{\partial t}\right) \right)^2$$
3. **Data Loss**:
   $$\mathcal{L}_{\text{data}} = \frac{1}{B} \sum_{i=1}^B (\text{RUL}_{i} - \widehat{\text{RUL}}_i)^2$$
4. **Composite Training Loss**:
   $$\mathcal{L}_{\text{total}} = \mathcal{L}_{\text{data}} + \lambda_{\text{physics}} \mathcal{L}_{\text{physics}} + \lambda_{\text{constraint}} \mathcal{L}_{\text{monotonicity}}$$
   where $\lambda_{\text{physics}} = 0.1$ and $\lambda_{\text{constraint}} = 0.1$.

Derivatives $\frac{\partial \widehat{\text{RUL}}}{\partial t}$ are calculated via exact **automatic differentiation** (`tf.GradientTape`) with respect to normalized operational time $t$.

---

## 5. Artifact Directory Structure

To ensure complete dataset isolation with zero crosstalk:
```
backend/artifacts/
├── pinn/
│   ├── FD001/
│   │   ├── pinn_model.keras
│   │   ├── scaler.joblib
│   │   ├── feature_columns.json
│   │   ├── model_metadata.json
│   │   ├── pinn_metrics.json
│   │   └── plots/
│   ├── FD002/
│   │   └── ...
│   ├── FD003/
│   │   └── ...
│   └── FD004/
│       └── ...
└── legacy_lstm/ (preserved baseline)
    ├── lstm_model.keras
    ├── scaler.joblib
    └── lstm_metrics.json
```

---

## 6. Migration Execution Phases

1. **Phase 1 — Ingestion Pipeline**:
   - Update `ingest_data.py` to copy and validate FD001, FD002, FD003, and FD004 from `archive/` to `backend/data/raw/`.
2. **Phase 2 — Preprocessing Refactoring**:
   - Update `preprocessor.py` to support dataset-specific feature selection, operating setting clustering, and strict train-only fitting.
3. **Phase 3 — PINN Core Model & Pipeline**:
   - Implement `backend/app/ml/pinn_model.py` with automatic differentiation, physics loss, and monotonicity loss.
   - Implement `backend/ml_pipeline/train_pinn.py` supporting `--dataset FD001|FD002|FD003|FD004|all`.
4. **Phase 4 — Independent Evaluation & Benchmarking**:
   - Implement `backend/ml_pipeline/evaluate_pinn.py` to evaluate each dataset on its matching official `RUL_FD00X.txt` test set.
5. **Phase 5 — Predictor & FastAPI Integration**:
   - Update `CMapssPredictor` to load the appropriate dataset bundle with fallback to `FD001`.
   - Update schemas, endpoints, and health check with `dataset`, `model_type="PINN"`, and `model_version`.
6. **Phase 6 — Frontend Dataset Selector**:
   - Add a dataset selector dropdown in the React dashboard, passing the selected dataset to the backend.
7. **Phase 7 — Verification & Documentation**:
   - Train and evaluate models across all 4 datasets.
   - Run unit and integration tests.
   - Document results in `docs/PINN_EVALUATION.md` and `README.md`.
