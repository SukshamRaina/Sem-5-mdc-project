import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Activity, Sliders, Info } from 'lucide-react';
import Card from '../common/Card';
import { SENSOR_METADATA } from '../../constants/sensorMetadata';

export default function SensorTelemetryChart({ sensorData, engineId }) {
  const [primarySensor, setPrimarySensor] = useState('sensor_11'); // HPC outlet static pressure (top correlated)
  const [secondarySensor, setSecondarySensor] = useState('sensor_4'); // LPT outlet temperature

  if (!sensorData || sensorData.length === 0) {
    return (
      <Card
        title="Physical Sensor Telemetry Trends"
        subtitle="Observed flight sensor observations extracted directly from uploaded telemetry payload"
        icon={Activity}
      >
        <div className="empty-state">
          <Info size={28} className="empty-state-icon" />
          <p>
            No sensor telemetry data loaded. Upload a CSV file to inspect real cycle-by-cycle physical sensor channels.
          </p>
        </div>
      </Card>
    );
  }

  // Detect which sensors are actually present in the data rows
  const availableSensors = Object.keys(SENSOR_METADATA).filter((sensorKey) =>
    sensorData.some((row) => row[sensorKey] !== undefined && row[sensorKey] !== null)
  );

  const primaryMeta = SENSOR_METADATA[primarySensor] || {
    name: primarySensor,
    fullName: primarySensor,
    unit: '',
  };

  const secondaryMeta =
    secondarySensor && secondarySensor !== 'none'
      ? SENSOR_METADATA[secondarySensor] || {
          name: secondarySensor,
          fullName: secondarySensor,
          unit: '',
        }
      : null;

  const CustomSensorTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="recharts-custom-tooltip">
          <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
            Flight Cycle #{label} (Observed)
          </div>
          {payload.map((entry, index) => {
            const isPrimary = entry.dataKey === primarySensor;
            const meta = isPrimary ? primaryMeta : secondaryMeta;
            return (
              <div
                key={index}
                style={{
                  color: entry.color,
                  fontWeight: 500,
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <span>{meta ? `${meta.name} (${meta.fullName})` : entry.name}:</span>
                <span style={{ fontWeight: 700 }}>
                  {typeof entry.value === 'number' ? entry.value.toFixed(3) : entry.value}{' '}
                  {meta?.unit}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <Card
      title={`Sensor Telemetry Degradation Observations (Engine #${engineId || 1})`}
      subtitle="Physical thermodynamic and pressure measurements across operational cycles"
      icon={Activity}
      action={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="badge badge-neutral"
            style={{ textTransform: 'none', fontWeight: 500 }}
          >
            Actual Observed Telemetry (Raw)
          </span>
        </div>
      }
    >
      {/* Sensor Selection Controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '20px',
          padding: '12px 14px',
          backgroundColor: 'var(--bg-canvas)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-light)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={15} style={{ color: 'var(--text-secondary)' }} />
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
            Primary Sensor (Left Axis):
          </label>
          <select
            value={primarySensor}
            onChange={(e) => setPrimarySensor(e.target.value)}
            className="form-select"
            style={{ fontSize: '12px', padding: '4px 8px' }}
          >
            {availableSensors.map((key) => {
              const meta = SENSOR_METADATA[key];
              return (
                <option key={key} value={key}>
                  {meta ? `${key} &bull; ${meta.name} - ${meta.fullName} [${meta.unit}]` : key}
                </option>
              );
            })}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
            Comparison Sensor (Right Axis):
          </label>
          <select
            value={secondarySensor}
            onChange={(e) => setSecondarySensor(e.target.value)}
            className="form-select"
            style={{ fontSize: '12px', padding: '4px 8px' }}
          >
            <option value="none">None (Single Sensor)</option>
            {availableSensors
              .filter((key) => key !== primarySensor)
              .map((key) => {
                const meta = SENSOR_METADATA[key];
                return (
                  <option key={key} value={key}>
                    {meta ? `${key} &bull; ${meta.name} - ${meta.fullName} [${meta.unit}]` : key}
                  </option>
                );
              })}
          </select>
        </div>
      </div>

      {/* Recharts Sensor Curve */}
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={sensorData}
            margin={{ top: 10, right: secondaryMeta ? 35 : 20, left: 10, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="cycle"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              label={{
                value: 'Operational Flight Cycle',
                position: 'insideBottom',
                offset: -10,
                fontSize: 12,
                fill: '#64748b',
              }}
            />
            <YAxis
              yAxisId="left"
              stroke="#0d9488"
              fontSize={12}
              tickLine={false}
              domain={['auto', 'auto']}
              label={{
                value: primaryMeta
                  ? `${primaryMeta.fullName} [${primaryMeta.unit}]`
                  : primarySensor,
                angle: -90,
                position: 'insideLeft',
                offset: 5,
                fontSize: 11,
                fill: '#0d9488',
              }}
            />
            {secondaryMeta && (
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#d97706"
                fontSize={12}
                tickLine={false}
                domain={['auto', 'auto']}
                label={{
                  value: `${secondaryMeta.fullName} [${secondaryMeta.unit}]`,
                  angle: 90,
                  position: 'insideRight',
                  offset: 5,
                  fontSize: 11,
                  fill: '#d97706',
                }}
              />
            )}
            <Tooltip content={<CustomSensorTooltip />} />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />

            <Line
              yAxisId="left"
              type="monotone"
              dataKey={primarySensor}
              name={`${primaryMeta.name} - ${primaryMeta.fullName} (${primaryMeta.unit})`}
              stroke="#0d9488"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
            />

            {secondaryMeta && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey={secondarySensor}
                name={`${secondaryMeta.name} - ${secondaryMeta.fullName} (${secondaryMeta.unit})`}
                stroke="#d97706"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          marginTop: '12px',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          borderTop: '1px solid var(--border-light)',
          paddingTop: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <span>
          <strong>Channel Info:</strong> {primaryMeta.fullName} &bull; {primaryMeta.description}
        </span>
        <span>Observed Telemetry Channel: {primarySensor}</span>
      </div>
    </Card>
  );
}
