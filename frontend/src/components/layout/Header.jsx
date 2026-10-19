import React from 'react';
import { Activity, Cpu, Database, RefreshCw } from 'lucide-react';

export default function Header({ health, isCheckingHealth, onRefreshHealth }) {
  const isHealthy = health?.status === 'healthy';
  const isDegraded = health?.status === 'degraded';

  return (
    <header className="top-header">
      <div className="header-inner">
        <div className="brand-section">
          <div className="brand-icon">
            <Activity size={22} />
          </div>
          <div className="brand-text">
            <h1>NASA C-MAPSS Predictive Maintenance</h1>
            <p>Academic Turbofan Degradation & Remaining Useful Life (RUL) Analyzer</p>
          </div>
        </div>

        <div className="header-status">
          {/* Supabase status indicator */}
          <div
            className="status-pill status-neutral"
            title={
              health?.database_connected
                ? `Database Connected (${health.database_type})`
                : 'Operating in In-Memory Cache Mode'
            }
          >
            <Database size={13} style={{ color: 'var(--text-secondary)' }} />
            <span>
              {health?.database_type === 'supabase'
                ? 'Supabase DB'
                : health?.database_type || 'DB Checking...'}
            </span>
          </div>

          {/* Model info pill */}
          <div
            className="status-pill status-neutral"
            title={`Artifact: ${health?.model_version || 'Loading...'} (W=${health?.sequence_length || 30}, Features=${health?.features_count || 14})`}
          >
            <Cpu size={13} style={{ color: 'var(--text-secondary)' }} />
            <span>LSTM Regressor</span>
          </div>

          {/* System Health Status */}
          <div
            className={`status-pill ${
              isHealthy
                ? 'status-healthy'
                : isDegraded
                ? 'status-warning'
                : 'status-critical'
            }`}
            title={
              isHealthy
                ? `FastAPI Backend Online & ML Model Ready (${health?.model_version})`
                : isDegraded
                ? 'Backend degraded: ML model or scaler not loaded'
                : 'FastAPI Backend Offline or Unreachable'
            }
          >
            <span
              className={`status-dot ${
                isHealthy
                  ? 'healthy pulse'
                  : isDegraded
                  ? 'warning'
                  : 'critical'
              }`}
            />
            <span>
              {isHealthy
                ? 'Backend Live'
                : isDegraded
                ? 'Degraded'
                : 'Backend Offline'}
            </span>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={onRefreshHealth}
            disabled={isCheckingHealth}
            className="btn btn-secondary btn-sm"
            title="Refresh backend status"
            aria-label="Refresh backend status"
          >
            <RefreshCw
              size={13}
              style={{
                animation: isCheckingHealth ? 'spin 1s linear infinite' : 'none',
              }}
            />
          </button>
        </div>
      </div>
    </header>
  );
}
