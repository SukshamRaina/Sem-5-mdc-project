import React from 'react';
import { BookOpen, ShieldCheck } from 'lucide-react';

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-light)',
        backgroundColor: '#ffffff',
        padding: '20px',
        marginTop: 'auto',
        fontSize: '12px',
        color: 'var(--text-secondary)',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={16} style={{ color: 'var(--primary-600)' }} />
          <span>
            <strong>AI-Based Predictive Maintenance</strong> &bull; NASA Ames Prognostics Data Repository (C-MAPSS FD001)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <BookOpen size={14} />
            Academic Decision Support Prototype &bull; Non-Critical Evaluation
          </span>
          <span>FastAPI + Stacked LSTM (W=30)</span>
        </div>
      </div>
    </footer>
  );
}
