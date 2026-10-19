-- ====================================================================
-- NASA C-MAPSS Predictive Maintenance System — Supabase Database DDL
-- Table definitions, indexes, constraints, and Row-Level Security (RLS)
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Drop existing tables if re-initializing
-- DROP TABLE IF EXISTS maintenance_records CASCADE;
-- DROP TABLE IF EXISTS predictions CASCADE;

-- 3. Predictions Table
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engine_id INTEGER NOT NULL,
    current_cycle INTEGER NOT NULL,
    cycles_analyzed INTEGER NOT NULL,
    predicted_rul DOUBLE PRECISION NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('CRITICAL', 'WARNING', 'MODERATE', 'HEALTHY')),
    risk_color TEXT,
    recommendation TEXT,
    model_version TEXT NOT NULL,
    features_used JSONB NOT NULL DEFAULT '[]'::jsonb,
    input_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast query and filtering
CREATE INDEX IF NOT EXISTS idx_predictions_engine_id ON predictions(engine_id);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_risk_level ON predictions(risk_level);

-- 4. Maintenance Records Table
CREATE TABLE IF NOT EXISTS maintenance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id UUID REFERENCES predictions(id) ON DELETE CASCADE,
    engine_id INTEGER NOT NULL,
    action_taken TEXT NOT NULL,
    technician_id TEXT,
    scheduled_cycle INTEGER,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_engine_id ON maintenance_records(engine_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_records(status);

-- 5. Row-Level Security (RLS) Configuration
-- The backend MUST connect using the SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
-- These policies apply only when requests arrive via the anon / authenticated key.
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- predictions: read-only for the anonymous role (React dashboard read path).
-- All writes come from the backend service-role key and bypass RLS entirely.
-- --------------------------------------------------------------------------
CREATE POLICY "anon_read_predictions"
    ON predictions FOR SELECT
    TO anon
    USING (true);

-- Deny any INSERT/UPDATE/DELETE from the anon or authenticated roles.
-- (Service-role key bypasses these policies automatically.)
CREATE POLICY "deny_anon_insert_predictions"
    ON predictions FOR INSERT
    TO anon
    WITH CHECK (false);

CREATE POLICY "deny_anon_update_predictions"
    ON predictions FOR UPDATE
    TO anon
    USING (false);

CREATE POLICY "deny_anon_delete_predictions"
    ON predictions FOR DELETE
    TO anon
    USING (false);

-- --------------------------------------------------------------------------
-- maintenance_records: read-only for anon; writes via service-role only.
-- --------------------------------------------------------------------------
CREATE POLICY "anon_read_maintenance_records"
    ON maintenance_records FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "deny_anon_insert_maintenance_records"
    ON maintenance_records FOR INSERT
    TO anon
    WITH CHECK (false);

CREATE POLICY "deny_anon_update_maintenance_records"
    ON maintenance_records FOR UPDATE
    TO anon
    USING (false);

CREATE POLICY "deny_anon_delete_maintenance_records"
    ON maintenance_records FOR DELETE
    TO anon
    USING (false);
