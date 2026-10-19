import React from 'react';
import {
  Calendar,
  Cpu,
  Database,
  FileText,
  Gauge,
  Layers,
  Wrench,
} from 'lucide-react';
import Modal from '../common/Modal';
import Badge from '../common/Badge';
import { SENSOR_METADATA, getRiskInfo } from '../../constants/sensorMetadata';

export default function RecordDetailModal({ record, isOpen, onClose }) {
  if (!record) return null;

  const {
    id,
    engine_id,
    current_cycle,
    cycles_analyzed,
    predicted_rul,
    risk_level,
    recommendation,
    model_version,
    features_used = [],
    input_metadata = {},
    created_at,
  } = record;

  const riskInfo = getRiskInfo(risk_level);

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Prediction Record Details — Engine #${engine_id}`}
      maxWidth="700px"
      footer={
        <button onClick={onClose} className="btn btn-secondary">
          Close
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Top Summary Banner */}
        <div
          style={{
            padding: '16px',
            backgroundColor: riskInfo.bgColor,
            border: `1px solid ${riskInfo.borderColor}`,
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              ESTIMATED REMAINING USEFUL LIFE
            </div>
            <div
              style={{
                fontSize: '32px',
                fontWeight: 800,
                color: riskInfo.color,
                display: 'flex',
                alignItems: 'baseline',
                gap: '6px',
              }}
            >
              <span>{predicted_rul}</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                cycles
              </span>
            </div>
          </div>
          <Badge level={risk_level} />
        </div>

        {/* Telemetry & Inference Metadata Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
          }}
        >
          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              RECORD UUID
            </div>
            <div
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-main)',
                marginTop: '4px',
                wordBreak: 'break-all',
              }}
            >
              {id}
            </div>
          </div>

          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              TIMESTAMP (UTC)
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-main)', marginTop: '4px' }}>
              {formatDate(created_at)}
            </div>
          </div>

          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              OBSERVED CYCLES
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginTop: '4px' }}>
              Current Cycle: {current_cycle} (Analyzed: {cycles_analyzed})
            </div>
          </div>

          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              MODEL ARCHITECTURE
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-main)', marginTop: '4px' }}>
              {model_version} &bull; Window: {input_metadata.sequence_length || 30}
            </div>
          </div>
        </div>

        {/* Maintenance Recommendation */}
        <div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-main)',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Wrench size={14} style={{ color: 'var(--primary-700)' }} />
            <span>ENGINEERING ADVISORY RECOMMENDATION</span>
          </div>
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              color: 'var(--text-body)',
              lineHeight: 1.5,
            }}
          >
            {recommendation || 'Turbofan engine operating within nominal degradation tolerances.'}
          </div>
        </div>

        {/* Feature Columns Used */}
        {features_used && features_used.length > 0 && (
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-main)',
                marginBottom: '8px',
              }}
            >
              ACTIVE SENSORS EVALUATED ({features_used.length} CHANNELS)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {features_used.map((feat) => {
                const meta = SENSOR_METADATA[feat];
                return (
                  <span
                    key={feat}
                    className="badge badge-neutral"
                    style={{ fontSize: '11px', textTransform: 'none' }}
                    title={meta ? `${meta.fullName} (${meta.description})` : feat}
                  >
                    <strong>{feat}</strong>: {meta ? meta.name : ''}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
