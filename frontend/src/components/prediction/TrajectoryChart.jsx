import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { TrendingDown, Info } from 'lucide-react';
import Card from '../common/Card';
import { getRiskInfo } from '../../constants/sensorMetadata';

function renderTrajectoryTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const riskInfo = getRiskInfo(data.risk_level);
    return (
      <div className="recharts-custom-tooltip">
        <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
          Flight Cycle #{label}
        </div>
        <div style={{ color: 'var(--primary-700)', fontWeight: 600 }}>
          Estimated RUL: {data.predicted_rul} cycles
        </div>
        <div style={{ marginTop: '4px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: riskInfo.color,
              backgroundColor: riskInfo.bgColor,
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            {riskInfo.label}
          </span>
        </div>
      </div>
    );
  }
  return null;
}

export default function TrajectoryChart({ trajectory, engineId }) {
  if (!trajectory || trajectory.length === 0) {
    return (
      <Card
        title="RUL Degradation Trajectory"
        subtitle="Cycle-by-cycle model predictions across operational timeline"
        icon={TrendingDown}
      >
        <div className="empty-state">
          <Info size={28} className="empty-state-icon" />
          <p>
            Historical trajectory curve is available when sequence contains sufficient operational cycles (&ge; 30).
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={`Degradation Trajectory Curve (Engine #${engineId || 1})`}
      subtitle="Estimated Remaining Useful Life evolution calculated by sliding LSTM window"
      icon={TrendingDown}
    >
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={trajectory}
            margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="cycle"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              label={{
                value: 'Operational Flight Cycle (Elapsed)',
                position: 'insideBottom',
                offset: -10,
                fontSize: 12,
                fill: '#64748b',
              }}
            />
            <YAxis
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              domain={[0, 'dataMax + 15']}
              label={{
                value: 'Predicted RUL (Cycles)',
                angle: -90,
                position: 'insideLeft',
                offset: 5,
                fontSize: 12,
                fill: '#64748b',
              }}
            />
            <Tooltip content={renderTrajectoryTooltip} />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />

            {/* Threshold reference lines */}
            <ReferenceLine
              y={25}
              stroke="#dc2626"
              strokeDasharray="4 4"
              label={{
                value: 'Critical Threshold (25)',
                position: 'right',
                fill: '#dc2626',
                fontSize: 10,
              }}
            />
            <ReferenceLine
              y={50}
              stroke="#d97706"
              strokeDasharray="4 4"
              label={{
                value: 'Warning (50)',
                position: 'right',
                fill: '#d97706',
                fontSize: 10,
              }}
            />
            <ReferenceLine
              y={80}
              stroke="#2563eb"
              strokeDasharray="4 4"
              label={{
                value: 'Moderate (80)',
                position: 'right',
                fill: '#2563eb',
                fontSize: 10,
              }}
            />

            <Line
              type="monotone"
              dataKey="predicted_rul"
              name="Predicted RUL"
              stroke="#1d4ed8"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#1d4ed8' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          marginTop: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          borderTop: '1px solid var(--border-light)',
          paddingTop: '8px',
        }}
      >
        <span>&bull; RUL &le; 25: Critical Action Window</span>
        <span>&bull; RUL 26&ndash;50: Planned Shop Maintenance</span>
        <span>&bull; RUL 51&ndash;80: Moderate Wear Phase</span>
        <span>&bull; RUL &gt; 80: Nominal Degradation</span>
      </div>
    </Card>
  );
}
