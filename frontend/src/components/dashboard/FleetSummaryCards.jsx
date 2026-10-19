import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Info,
  Plane,
  UploadCloud,
} from 'lucide-react';
import StatCard from '../common/StatCard';

export default function FleetSummaryCards({
  summary,
  onNavigateToUpload,
}) {
  if (!summary) {
    return (
      <div
        style={{
          padding: '24px',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-xs)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary-50)',
            color: 'var(--primary-700)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <UploadCloud size={20} />
        </div>
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
            No Active Inference Results in Current Session
          </h4>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '480px', marginTop: '4px' }}>
            Fleet-level degradation statistics (engine counts, health distribution, and mean RUL) are computed dynamically from your uploaded telemetry data.
          </p>
        </div>
        {onNavigateToUpload && (
          <button
            onClick={onNavigateToUpload}
            className="btn btn-outline-primary btn-sm"
            style={{ marginTop: '4px' }}
          >
            <span>Upload Telemetry File</span>
          </button>
        )}
      </div>
    );
  }

  const {
    total_engines = 0,
    critical_count = 0,
    warning_count = 0,
    moderate_count = 0,
    healthy_count = 0,
    min_rul = null,
    avg_rul = null,
    highest_risk_engine_id = null,
  } = summary;

  return (
    <div className="stats-grid">
      <StatCard
        label="Engines Evaluated"
        value={total_engines}
        meta="Distinct turbofan units in run"
        icon={Plane}
      />
      <StatCard
        label="Healthy Systems"
        value={healthy_count}
        meta="RUL > 80 cycles (Nominal)"
        icon={CheckCircle2}
        variant="healthy"
      />
      <StatCard
        label="Moderate Degradation"
        value={moderate_count}
        meta="51 – 80 cycles (Advisory)"
        icon={Info}
        variant="moderate"
      />
      <StatCard
        label="Maintenance Warnings"
        value={warning_count}
        meta="26 – 50 cycles (Plan Service)"
        icon={AlertTriangle}
        variant="warning"
      />
      <StatCard
        label="Critical Alerts"
        value={critical_count}
        meta="RUL <= 25 cycles (Immediate)"
        icon={AlertCircle}
        variant="critical"
      />
      <StatCard
        label="Fleet Mean RUL"
        value={avg_rul !== null && avg_rul !== undefined ? avg_rul : '—'}
        unit={avg_rul !== null ? 'cycles' : ''}
        meta="Average remaining life in batch"
        icon={Gauge}
      />
      <StatCard
        label="Lowest Batch RUL"
        value={min_rul !== null && min_rul !== undefined ? min_rul : '—'}
        unit={min_rul !== null ? 'cycles' : ''}
        meta={
          highest_risk_engine_id !== null && highest_risk_engine_id !== undefined
            ? `Engine #${highest_risk_engine_id} highest risk`
            : 'Lowest life candidate'
        }
        icon={AlertCircle}
        variant={
          min_rul !== null && min_rul <= 25
            ? 'critical'
            : min_rul !== null && min_rul <= 50
            ? 'warning'
            : 'healthy'
        }
      />
    </div>
  );
}
