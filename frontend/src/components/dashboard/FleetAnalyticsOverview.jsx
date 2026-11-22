import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  ShieldAlert,
  Gauge,
  Activity,
  Layers,
  Wrench,
} from 'lucide-react';
import Card from '../common/Card';

export default function FleetAnalyticsOverview({
  predictionResponse,
  historyRecords = [],
  historyTotal = 0,
}) {
  // Derive fleet metrics from active batch or loaded history
  const hasActiveBatch = !!predictionResponse?.predictions?.length;

  const totalEngines = hasActiveBatch
    ? predictionResponse.fleet_summary.total_engines
    : historyRecords.length;

  const avgRul = hasActiveBatch
    ? predictionResponse.fleet_summary.average_rul
    : historyRecords.length > 0
    ? historyRecords.reduce((acc, r) => acc + (r.predicted_rul || 0), 0) / historyRecords.length
    : 0;

  const criticalCount = hasActiveBatch
    ? predictionResponse.fleet_summary.critical_count
    : historyRecords.filter((r) => r.risk_level === 'CRITICAL').length;

  const warningCount = hasActiveBatch
    ? predictionResponse.fleet_summary.warning_count
    : historyRecords.filter((r) => r.risk_level === 'WARNING').length;

  const moderateCount = hasActiveBatch
    ? predictionResponse.fleet_summary.moderate_count
    : historyRecords.filter((r) => r.risk_level === 'MODERATE').length;

  const healthyCount = hasActiveBatch
    ? predictionResponse.fleet_summary.healthy_count
    : historyRecords.filter((r) => r.risk_level === 'HEALTHY').length;

  const attentionRequired = criticalCount + warningCount;
  const fleetHealthIndex = totalEngines > 0
    ? Math.round(((healthyCount + moderateCount * 0.7) / totalEngines) * 100)
    : 100;

  // RUL Distribution Bins
  const rulDistribution = [
    { range: '0–25 Cycles', count: criticalCount, label: 'Critical Risk', color: '#ef4444' },
    { range: '26–50 Cycles', count: warningCount, label: 'Warning', color: '#f59e0b' },
    { range: '51–80 Cycles', count: moderateCount, label: 'Moderate', color: '#38bdf8' },
    { range: '81+ Cycles', count: healthyCount, label: 'Nominal Health', color: '#10b981' },
  ];

  // Health distribution data for Pie Chart
  const healthDistribution = [
    { name: 'Nominal (Healthy)', value: healthyCount, color: '#10b981' },
    { name: 'Moderate Wear', value: moderateCount, color: '#38bdf8' },
    { name: 'Maintenance Warning', value: warningCount, color: '#f59e0b' },
    { name: 'Critical Failure Risk', value: criticalCount, color: '#ef4444' },
  ].filter((item) => item.value > 0);

  // Maintenance Priority Breakdown
  const priorityBreakdown = [
    {
      tier: 'P1 Immediate',
      count: criticalCount,
      desc: 'Grounding & Borescope Inspection',
      color: 'var(--critical-main)',
      bg: 'var(--critical-bg)',
      border: 'var(--critical-border)',
    },
    {
      tier: 'P2 Urgent',
      count: warningCount,
      desc: 'Next Maintenance Flight Cycle',
      color: 'var(--warning-main)',
      bg: 'var(--warning-bg)',
      border: 'var(--warning-border)',
    },
    {
      tier: 'P3 Routine',
      count: moderateCount,
      desc: 'Scheduled Depot Turnaround',
      color: 'var(--moderate-main)',
      bg: 'var(--moderate-bg)',
      border: 'var(--moderate-border)',
    },
    {
      tier: 'P4 Deferred',
      count: healthyCount,
      desc: 'Standard Telemetry Monitoring',
      color: 'var(--healthy-main)',
      bg: 'var(--healthy-bg)',
      border: 'var(--healthy-border)',
    },
  ];

  const renderTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="recharts-custom-tooltip">
          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
            {data.range || data.name}
          </div>
          <div style={{ color: data.color, fontWeight: 600, marginTop: '2px' }}>
            Engines: {payload[0].value} units
          </div>
          {data.label && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Status: {data.label}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 4 Top Aviation Fleet KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* KPI 1: Total Units */}
        <div className="stat-card">
          <div className="stat-label">
            <span>Total Engines Evaluated</span>
            <Layers size={16} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div className="stat-value">
            {totalEngines}
            <span className="stat-unit">Units</span>
          </div>
          <div className="stat-meta">
            {hasActiveBatch ? 'Active multi-engine batch' : `${historyTotal} total records in database`}
          </div>
        </div>

        {/* KPI 2: Fleet Average RUL */}
        <div className="stat-card">
          <div className="stat-label">
            <span>Fleet Mean RUL</span>
            <Gauge size={16} style={{ color: avgRul < 50 ? 'var(--warning-main)' : 'var(--moderate-main)' }} />
          </div>
          <div className="stat-value" style={{ color: avgRul < 30 ? 'var(--critical-main)' : 'var(--text-main)' }}>
            {avgRul.toFixed(1)}
            <span className="stat-unit">Cycles</span>
          </div>
          <div className="stat-meta">
            Operating cycles until component retirement
          </div>
        </div>

        {/* KPI 3: Requiring Attention */}
        <div
          className="stat-card"
          style={{
            borderLeft: attentionRequired > 0 ? '4px solid var(--critical-main)' : undefined,
          }}
        >
          <div className="stat-label">
            <span>Requiring Attention</span>
            <ShieldAlert size={16} style={{ color: attentionRequired > 0 ? 'var(--critical-main)' : 'var(--healthy-main)' }} />
          </div>
          <div
            className="stat-value"
            style={{ color: attentionRequired > 0 ? 'var(--critical-main)' : 'var(--healthy-main)' }}
          >
            {attentionRequired}
            <span className="stat-unit">Engines</span>
          </div>
          <div className="stat-meta">
            {criticalCount} Critical (RUL &le; 25) &bull; {warningCount} Warning (RUL &le; 50)
          </div>
        </div>

        {/* KPI 4: Fleet Health Index */}
        <div className="stat-card">
          <div className="stat-label">
            <span>Fleet Health Index</span>
            <Activity size={16} style={{ color: 'var(--healthy-main)' }} />
          </div>
          <div className="stat-value" style={{ color: 'var(--healthy-main)' }}>
            {fleetHealthIndex}%
          </div>
          <div className="stat-meta">
            Overall operational airworthiness ratio
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Chart 1: RUL Binned Distribution Histogram */}
        <Card
          title="Remaining Useful Life Distribution"
          subtitle="Fleet count segmented by prognostic operational cycle horizons"
          icon={Gauge}
        >
          <div style={{ height: '220px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rulDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="range" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip content={renderTooltip} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {rulDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 2: Fleet Health Ratio Donut */}
        <Card
          title="Fleet Health State Distribution"
          subtitle="Proportion of engines across nominal, moderate, warning and critical states"
          icon={Activity}
        >
          {healthDistribution.length === 0 ? (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              No telemetry analyzed yet in current session.
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', height: '220px', gap: '16px' }}>
              <div style={{ height: '100%', width: '55%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={renderTooltip} />
                    <Pie
                      data={healthDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {healthDistribution.map((entry, index) => (
                        <Cell key={`pie-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ width: '45%', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
                {healthDistribution.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                      <span style={{ color: 'var(--text-body)' }}>{item.name}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Maintenance Priority Overview Grid */}
      <Card
        title="Fleet Maintenance Priority Breakdown"
        subtitle="Operational triage queue mapped to hangar bay scheduling rules"
        icon={Wrench}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
          }}
        >
          {priorityBreakdown.map((p, idx) => (
            <div
              key={idx}
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: p.bg,
                border: `1px solid ${p.border}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: p.color }}>
                  {p.tier}
                </span>
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    color: p.color,
                  }}
                >
                  {p.count}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                {p.desc}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
