import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Info,
  Plane,
} from 'lucide-react';
import StatCard from '../common/StatCard';

export default function FleetSummaryCards({ summary, title = 'Fleet Health Overview' }) {
  if (!summary) {
    return (
      <div className="stats-grid">
        <StatCard
          label="Engines Analyzed"
          value="0"
          meta="No active predictions loaded"
          icon={Plane}
        />
        <StatCard
          label="Fleet Status"
          value="Awaiting Telemetry"
          meta="Upload CSV or load sample"
          icon={Gauge}
        />
        <StatCard
          label="Critical Alerts"
          value="0"
          meta="RUL <= 25 cycles"
          icon={AlertCircle}
          variant="critical"
        />
        <StatCard
          label="Mean Fleet RUL"
          value="—"
          unit="cycles"
          meta="Estimated life"
          icon={Gauge}
        />
      </div>
    );
  }

  const {
    total_engines = 0,
    critical_count = 0,
    warning_count = 0,
    moderate_count = 0,
    healthy_count = 0,
    min_rul = 0,
    avg_rul = 0,
    highest_risk_engine_id = null,
  } = summary;

  return (
    <div>
      <div className="stats-grid">
        <StatCard
          label="Total Engines"
          value={total_engines}
          meta="Distinct turbofan units"
          icon={Plane}
        />
        <StatCard
          label="Healthy Systems"
          value={healthy_count}
          meta="RUL > 80 cycles"
          icon={CheckCircle2}
          variant="healthy"
        />
        <StatCard
          label="Moderate Degradation"
          value={moderate_count}
          meta="50 < RUL <= 80 cycles"
          icon={Info}
          variant="moderate"
        />
        <StatCard
          label="Maintenance Warnings"
          value={warning_count}
          meta="25 < RUL <= 50 cycles"
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          label="Critical Failures"
          value={critical_count}
          meta="RUL <= 25 cycles (Immediate)"
          icon={AlertCircle}
          variant="critical"
        />
        <StatCard
          label="Fleet Average RUL"
          value={avg_rul}
          unit="cycles"
          meta="Mean remaining life"
          icon={Gauge}
        />
        <StatCard
          label="Minimum Fleet RUL"
          value={min_rul}
          unit="cycles"
          meta={
            highest_risk_engine_id !== null && highest_risk_engine_id !== undefined
              ? `Engine #${highest_risk_engine_id} highest risk`
              : 'Lowest predicted life'
          }
          icon={AlertCircle}
          variant={min_rul <= 25 ? 'critical' : min_rul <= 50 ? 'warning' : 'healthy'}
        />
      </div>
    </div>
  );
}
