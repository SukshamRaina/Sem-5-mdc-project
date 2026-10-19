import React from 'react';

export default function LoadingSpinner({
  size = 20,
  text = 'Processing...',
  inline = false,
  variant = 'primary',
}) {
  const spinnerElement = (
    <span
      className={`spinner ${variant === 'primary' ? 'spinner-primary' : ''}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );

  if (inline) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        {spinnerElement}
        {text && <span>{text}</span>}
      </span>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        gap: '12px',
        color: 'var(--text-secondary)',
        fontSize: '13px',
      }}
    >
      {spinnerElement}
      {text && <span>{text}</span>}
    </div>
  );
}
