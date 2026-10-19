# NASA C-MAPSS Predictive Maintenance — React Dashboard (Phase 3 & Phase 4)

Academic decision-support dashboard for Turbofan Engine Remaining Useful Life (RUL) estimation using Deep Learning (Stacked LSTM), gradient-based sensor explainability, and capacity-constrained fleet maintenance optimization based on the NASA Ames Prognostics Data Repository (C-MAPSS FD001).

---

## 1. System Overview

- **Frontend**: React 19 + Vite 8
- **Styling**: Vanilla CSS (Strict light-mode industrial analytics design system)
- **Visualizations**: Recharts for dynamic cycle-by-cycle degradation trajectories, physical sensor observations, and gradient-based feature attribution
- **Backend Service**: Python 3.13 + FastAPI + Pydantic v2
- **ML Engine**: Keras Stacked LSTM (64 -> 32 -> Dense) trained on 20,631 run-to-failure cycles
- **Explainability**: Exact Gradient-Based Input Sensitivity ($\nabla_X \hat{y}$ via `tf.GradientTape`) + Linear Sensor Degradation Drift Slopes
- **Optimization**: Deterministic Multi-Criteria Fleet Prioritization with configurable hangar bay capacities and service lead times
- **Database**: Supabase PostgreSQL with in-memory resilient fallback and work orders audit trail

---

## 2. Prerequisites & Setup

Ensure **Node.js (>= 18)** and **Python (>= 3.10)** are installed.

### Step 1: Start the FastAPI Backend

From the repository root directory:

```bash
# Start FastAPI backend service on port 8000
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Verify backend health at: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) or explore Swagger UI at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### Step 2: Install Frontend Dependencies

From the `frontend/` directory:

```bash
cd frontend
npm install
```

### Step 3: Configure Environment (Optional)

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | Target URL for the FastAPI backend. In development, you may leave it empty to use the built-in Vite reverse proxy on port 5173. |

> **Security Note**: Never commit `.env` files or include sensitive credentials, database keys, or passwords.

### Step 4: Run the Development Server

```bash
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your web browser.

---

## 3. Dashboard Features & Capabilities

### 1. Fleet Overview
- High-level health telemetry for active engine batches and overall database activity.
- Visual breakdown of fleet risk levels: `CRITICAL` (&le; 25 cycles), `WARNING` (25–50 cycles), `MODERATE` (50–80 cycles), and `HEALTHY` (> 80 cycles).

### 2. Telemetry & Prediction
- Ingest raw NASA C-MAPSS 26-column space-separated data or standard CSV with headers.
- Interactive drag-and-drop file upload with pre-validated sample datasets for quick evaluation.

### 3. Results & Sensor Analytics (Phase 4 Enhanced)
- **Transparent Decision Separation**: Clearly delineates the **LSTM statistical RUL prediction** from **rule-based decision-support policies**.
- **Actionable Maintenance Recommendations**: Priority tiers (`P1_IMMEDIATE`, `P2_URGENT`, `P3_ROUTINE`, `P4_DEFERRED`), technical justification, and mandatory `Human Review Required` flag.
- **Explainability & Feature Attribution**:
  - Exact gradient sensitivity bar chart showing relative influence of each sensor channel (sums to 100%).
  - Top 5 primary degradation drivers mapped to turbofan subsystems (HPC, HPT, LPT, Bypass Duct).
  - Diagnostic drift table displaying per-cycle slopes and Z-score standard deviations.
  - Collapsible architectural rationale explaining why `tf.GradientTape` was chosen over KernelSHAP for recurrent sequence networks.

### 4. Maintenance & Scheduling (Phase 4)
- **Capacity-Constrained Optimization**: Prioritizes engines deterministically:
  1. Priority Tier (P1 > P2 > P3 > P4)
  2. Lowest Predicted RUL (ascending)
  3. Highest Accumulated Flight Cycles (descending)
  4. Unit ID (ascending tie-breaker)
- **Hangar Bay Capacity & Lead Time Controls**: Configurable concurrent bays (default: 2) and parts staging buffer (default: 5 cycles), with automatic bottleneck detection warnings.
- **Work Orders & Service Records**: Full CRUD operations for technician dispatch, target cycle deadlines, status lifecycle (`PENDING` &rarr; `IN_PROGRESS` &rarr; `COMPLETED`), and engineering notes.

### 5. Prediction History
- Paginated search and inspection of historical inference runs stored in Supabase with metadata viewing.

---

## 4. Running Automated Tests & Production Build

### Run Frontend Unit & Integration Tests (32 Tests)
```bash
npm test
```

### Run Linter
```bash
npm run lint
```

### Build for Production
```bash
npm run build
```
The compiled, optimized production bundle will be generated in `frontend/dist/`.
