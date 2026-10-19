import React from 'react';

export default function StatCard({
  label,
  value,
  unit = '',
  meta,
  icon: Icon,
  variant = 'default', // 'default', 'healthy', 'warning', 'critical', 'moderate'
}) {
  const getBorderColor = () => {
    switch (variant) {
      case 'healthy':
        return 'var(--healthy-border)';
      case 'warning':
        return 'var(--warning-border)';
      case 'critical':
        return 'var(--critical-border)';
      case 'moderate':
        return 'var(--moderate-border)';
      default:
        return 'var(--border-light)';
    }
  };

  const getIconColor = () => {
    switch (variant) {
      case 'healthy':
        return 'var(--healthy-main)';
      case 'warning':
        return 'var(--warning-main)';
      case 'critical':
        return 'var(--critical-main)';
      case 'moderate':
        return 'var(--moderate-main)';
      default:
        return 'var(--text-secondary)';
    }
  };

  return (
    <div
      className="stat-card"
      style={{
        borderLeft: variant !== 'default' ? `4px solid ${getIconColor()}` : undefined,
        borderColor: getBorderColor(),
      }}
    >
      <div className="stat-label">
        <span>{label}</span>
        {Icon && <Icon size={16} color={getIconColor()} />}
      </div>
      <div>
        <div className="stat-value">
          {value !== null && value !== undefined ? value : '—'}
          {unit && <span className="stat-unit">{unit}</span>}
        </div>
        {meta && <div className="stat-meta">{meta}</div>}
      </div>
    </div>
  );
}
