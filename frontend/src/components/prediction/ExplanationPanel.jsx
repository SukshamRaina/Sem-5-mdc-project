import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Layers,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Card from '../common/Card';

export default function ExplanationPanel({ explanation, engineId }) {
  const [showShapNote, setShowShapNote] = useState(false);

  if (!explanation) {
    return (
      <Card
        title="ML Explainability & Sensor Feature Attribution"
        subtitle="Gradient sensitivity attribution and sensor degradation drift analysis"
        icon={Brain}
      >
        <div className="empty-state">
          <Info size={28} className="empty-state-icon" />
          <p>Feature attribution is computed upon running inference for an engine.</p>
        </div>
      </Card>
    );
  }

  const {
    attribution_method,
    method_limitation_note,
    feature_attributions = {},
    top_contributing_sensors = [],
    sensor_trends = {},
  } = explanation;

  // Prepare chart data sorted by attribution descending
  const chartData = Object.entries(feature_attributions)
    .map(([sensorKey, value]) => {
      const meta = sensor_trends[sensorKey] || {};
      return {
        sensor: sensorKey,
        displayName: meta.name ? `${meta.name} (${sensorKey})` : sensorKey,
        shortName: meta.name || sensorKey,
        attribution: Number(value),
        subsystem: meta.subsystem || 'Turbofan Component',
        driftDirection: meta.trend_direction || 'stable',
        slope: meta.trend_slope_per_cycle || 0,
      };
    })
    .sort((a, b) => b.attribution - a.attribution);

  // Bar colors according to attribution magnitude
  const getBarColor = (attribution) => {
    if (attribution >= 12.0) return '#dc2626'; // High impact (red)
    if (attribution >= 8.0) return '#d97706';  // Moderate impact (amber)
    if (attribution >= 5.0) return '#2563eb';  // Routine impact (blue)
    return '#64748b';                          // Low impact (slate)
  };

  const renderTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="recharts-custom-tooltip">
          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
            {item.displayName}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Subsystem: {item.subsystem}
          </div>
          <div style={{ color: 'var(--primary-700)', fontWeight: 600 }}>
            Model Attribution: {item.attribution}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Drift Slope: {item.slope > 0 ? `+${item.slope}` : item.slope} / cycle
          </div>
        </div>
      );
    };
    return null;
  };

  return (
    <Card
      title={`Explainability & Feature Attribution — Engine #${engineId}`}
      subtitle="Defensible gradient sensitivity & empirical sensor telemetry degradation metrics"
      icon={Brain}
    >
      {/* SHAP Limitation & Gradient Tape Methodology Disclosure */}
      <div
        style={{
          marginBottom: '20px',
          padding: '12px 16px',
          backgroundColor: 'var(--primary-50)',
          border: '1px solid var(--primary-100)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          onClick={() => setShowShapNote(!showShapNote)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} style={{ color: 'var(--primary-700)' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary-800)' }}>
              Attribution Methodology: {attribution_method}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}
          >
            {showShapNote ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Hide Rationale <ChevronUp size={12} />
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Why Gradient Tape over SHAP? <ChevronDown size={12} />
              </span>
            )}
          </button>
        </div>

        {showShapNote && (
          <div
            style={{
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px solid var(--primary-100)',
              fontSize: '12px',
              color: 'var(--text-body)',
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: 0 }}>
              <strong>Defensible Academic Rationale:</strong> {method_limitation_note}
            </p>
          </div>
        )}
      </div>

      {/* Grid: Feature Attribution Bar Chart + Top Drivers Breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
          marginBottom: '24px',
        }}
      >
        {/* Horizontal Bar Chart */}
        <div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text-main)',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Activity size={15} style={{ color: 'var(--primary-600)' }} />
            <span>Relative Sensor Sensitivity (%)</span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Analytical input gradient d(RUL)/d(X) across 30-cycle temporal window (Sums to 100%)
          </p>

          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  domain={[0, 'dataMax + 2']}
                  unit="%"
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                />
                <YAxis
                  dataKey="shortName"
                  type="category"
                  tick={{ fontSize: 11, fill: 'var(--text-main)', fontWeight: 600 }}
                  width={60}
                />
                <Tooltip content={renderTooltip} />
                <Bar dataKey="attribution" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.attribution)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 5 Primary Drivers Cards */}
        <div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text-main)',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <TrendingUp size={15} style={{ color: 'var(--warning-main)' }} />
            <span>Top Degradation Drivers</span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Key physical parameters influencing the neural network&apos;s remaining useful life estimate
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {top_contributing_sensors.map((sensor, idx) => {
              const isInc = sensor.trend_direction === 'increasing';
              const isDec = sensor.trend_direction === 'decreasing';
              const DirectionIcon = isInc ? TrendingUp : isDec ? TrendingDown : Minus;
              const directionColor = isInc
                ? 'var(--critical-main)'
                : isDec
                ? 'var(--warning-main)'
                : 'var(--text-secondary)';

              return (
                <div
                  key={sensor.sensor}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-canvas)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: idx === 0 ? 'var(--critical-bg)' : 'var(--bg-card-subtle)',
                        color: idx === 0 ? 'var(--critical-text)' : 'var(--text-secondary)',
                        fontSize: '11px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      #{idx + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {sensor.name} — {sensor.full_name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {sensor.subsystem} &bull; Channel: {sensor.sensor}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: getBarColor(sensor.attribution_percent),
                      }}
                    >
                      {sensor.attribution_percent}%
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: directionColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '2px',
                        marginTop: '2px',
                      }}
                    >
                      <DirectionIcon size={12} />
                      <span style={{ textTransform: 'capitalize' }}>
                        {sensor.trend_direction} ({sensor.trend_slope > 0 ? `+${sensor.trend_slope}` : sensor.trend_slope}/cyc)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sensor Drift & Subsystem Telemetry Table */}
      <div style={{ marginTop: '12px' }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--text-main)',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Diagnostic Subsystem & Drift Metrics</span>
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>
            Linear trend slope & Z-score deviation computed over latest 30 flight cycles
          </span>
        </div>

        <div className="table-container" style={{ maxHeight: '280px', overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Sensor Channel</th>
                <th>Subsystem</th>
                <th>Latest Value</th>
                <th>Trend Rate / Cycle</th>
                <th>Z-Score Deviation</th>
                <th>Attribution Weight</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(sensor_trends).map(([col, trend]) => {
                const attrVal = feature_attributions[col] || 0;
                const isHighZ = Math.abs(trend.z_score_deviation) > 2.0;

                return (
                  <tr key={col}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {trend.name} ({col})
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {trend.full_name}
                      </div>
                    </td>
                    <td style={{ fontSize: '12px' }}>{trend.subsystem}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600 }}>
                      {trend.latest_value} {trend.unit}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      <span
                        style={{
                          color: trend.trend_slope_per_cycle > 0
                            ? 'var(--critical-main)'
                            : trend.trend_slope_per_cycle < 0
                            ? 'var(--warning-main)'
                            : 'var(--text-secondary)',
                          fontWeight: 600,
                        }}
                      >
                        {trend.trend_slope_per_cycle > 0 ? `+${trend.trend_slope_per_cycle}` : trend.trend_slope_per_cycle}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${isHighZ ? 'badge-critical' : 'badge-healthy'}`}
                        style={{ fontSize: '11px' }}
                      >
                        {trend.z_score_deviation > 0 ? `+${trend.z_score_deviation}` : trend.z_score_deviation} &sigma;
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '6px',
                            backgroundColor: 'var(--border-light)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, attrVal * 5)}%`,
                              height: '100%',
                              backgroundColor: getBarColor(attrVal),
                            }}
                          />
                        </div>
                        <span>{attrVal}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
