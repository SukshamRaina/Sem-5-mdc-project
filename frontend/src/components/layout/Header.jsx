import React from 'react';
import {
  Activity,
  Database,
  RefreshCw,
  Menu,
} from 'lucide-react';

export default function Header({
  health,
  isCheckingHealth,
  onRefreshHealth,
  onToggleMobileSidebar,
}) {
  const isHealthy = health?.status === 'healthy';
  const isDegraded = health?.status === 'degraded';

  return (
    <header className="top-header">
      <div className="header-inner">
        {/* Brand & Mobile Toggle */}
        <div className="brand-section">
          {onToggleMobileSidebar && (
            <button
              type="button"
              onClick={onToggleMobileSidebar}
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px 8px', marginRight: '4px' }}
              aria-label="Toggle mobile menu"
            >
              <Menu size={18} />
            </button>
          )}

          <div className="brand-icon">
            <Activity size={22} />
          </div>

          <div className="brand-text">
            <h1>
              <span>NASA C-MAPSS Predictive Maintenance</span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-full)',
                  background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.25) 0%, rgba(59, 130, 246, 0.25) 100%)',
                  color: 'var(--accent-cyan)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  letterSpacing: '0.04em',
                }}
              >
                PINN PROGNOSTICS
              </span>
            </h1>
            <p>Academic Turbofan Degradation & Remaining Useful Life (RUL) Analyzer</p>
          </div>
        </div>

        {/* System Status Indicators & Reconnect */}
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
            type="button"
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
