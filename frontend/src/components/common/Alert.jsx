import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

export default function Alert({
  type = 'info', // 'info', 'success', 'warning', 'danger'
  title,
  children,
  onClose,
  className = '',
}) {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={18} style={{ color: 'var(--healthy-main)', flexShrink: 0 }} />;
      case 'warning':
        return <AlertTriangle size={18} style={{ color: 'var(--warning-main)', flexShrink: 0 }} />;
      case 'danger':
        return <AlertCircle size={18} style={{ color: 'var(--critical-main)', flexShrink: 0 }} />;
      default:
        return <Info size={18} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />;
    }
  };

  return (
    <div className={`alert alert-${type} ${className}`} role="alert">
      {getIcon()}
      <div style={{ flex: 1 }}>
        {title && <div style={{ fontWeight: 600, marginBottom: '2px' }}>{title}</div>}
        <div>{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            color: 'inherit',
            opacity: 0.7,
          }}
          aria-label="Close notification"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
