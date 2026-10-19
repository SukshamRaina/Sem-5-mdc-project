import React from 'react';
import Badge from '../common/Badge';

export default function EngineSelector({
  predictions = [],
  selectedEngineId,
  onSelectEngine,
}) {
  if (!predictions || predictions.length <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto',
        padding: '4px 0 12px 0',
        marginBottom: '16px',
        borderBottom: '1px solid var(--border-light)',
      }}
    >
      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginRight: '6px',
          whiteSpace: 'nowrap',
        }}
      >
        SELECT ENGINE UNIT:
      </span>
      {predictions.map((p) => {
        const isSelected = selectedEngineId === p.engine_id;
        return (
          <button
            key={p.engine_id}
            onClick={() => onSelectEngine(p.engine_id)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${isSelected ? 'var(--primary-700)' : 'var(--border-medium)'}`,
              backgroundColor: isSelected ? 'var(--primary-50)' : '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                fontSize: '13px',
                fontWeight: isSelected ? 700 : 500,
                color: isSelected ? 'var(--primary-800)' : 'var(--text-main)',
              }}
            >
              Engine #{p.engine_id}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              ({p.predicted_rul} cycles)
            </span>
            <Badge level={p.risk_level} />
          </button>
        );
      })}
    </div>
  );
}
