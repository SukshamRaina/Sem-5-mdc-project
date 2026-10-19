import React from 'react';
import { getRiskInfo } from '../../constants/sensorMetadata';

export default function Badge({ level, text, className = '' }) {
  const riskInfo = getRiskInfo(level);
  const displayText = text || riskInfo.label || level;

  return (
    <span
      className={`badge ${riskInfo.badgeClass} ${className}`}
      title={riskInfo.description}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: riskInfo.color,
          display: 'inline-block',
          marginRight: '2px',
        }}
      />
      {displayText}
    </span>
  );
}
