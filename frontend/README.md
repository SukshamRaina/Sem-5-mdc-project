# NASA C-MAPSS Predictive Maintenance — React Dashboard (Phase 3)

Academic decision-support dashboard for Turbofan Engine Remaining Useful Life (RUL) estimation using Deep Learning (Stacked LSTM) based on the NASA Ames Prognostics Data Repository (C-MAPSS FD001).

---

## 1. System Overview

- **Frontend**: React 19 + Vite 8
- **Styling**: Vanilla CSS (Strict light-mode industrial analytics design system)
- **Visualizations**: Recharts for dynamic cycle-by-cycle degradation trajectories and physical sensor observations
- **Backend Service**: Python 3.13 + FastAPI + Pydantic
- **ML Engine**: Keras Stacked LSTM (64 -> 32 -> Dense) trained on 20,631 run-to-failure cycles
- **Database**: Supabase PostgreSQL with in-memory resilient fallback

---

## 2. Prerequisites & Setup

Ensure **Node.js (>= 18)** and **Python (>= 3.10)** are installed.

### Step 1: Start the FastAPI Backend

From the repository root directory:

```bash
# Activate virtual environment if configured
# Run FastAPI server on port 8000
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

## 3. Telemetry Ingestion & Prediction Workflow

1. **Select Telemetry File**:
   - Drag and drop or browse for a `.csv` or space-separated NASA C-MAPSS `.txt` file.
   - Alternatively, use one of the pre-validated test buttons (`sample_engine_1.csv`, `sample_multi_engine.csv`, `sample_engine_near_failure.csv`).
2. **Execute Inference**:
   - Click **Execute RUL Prediction** to submit the file to `POST /predict`.
   - The backend validates sensor columns, scales inputs using the fitted training scaler with zero data leakage, and runs LSTM inference.
3. **Analyze Results**:
   - Inspect predicted Remaining Useful Life (RUL) in operational flight cycles.
   - Review the deterministic risk tier (`HEALTHY`, `MODERATE`, `WARNING`, `CRITICAL`) and engineering maintenance advisory.
   - Explore the degradation trajectory curve and individual sensor readings across flight cycles.
4. **Inspect Prediction History**:
   - Navigate to the **Prediction History** tab to view persistent logs stored in Supabase with pagination and filtering by Engine ID and Risk Tier.

---

## 4. Running Automated Tests & Production Build

### Run Frontend Unit Tests
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
The compiled output will be generated in `frontend/dist/`.
