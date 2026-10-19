import React from 'react';
import { Cpu, Database, Layers, Shield, Sliders } from 'lucide-react';
import Card from '../common/Card';

export default function SystemHealthCard({ health, isCheckingHealth }) {
  const isHealthy = health?.status === 'healthy';

  return (
    <Card
      title="System Operational Readiness"
      subtitle="FastAPI Microservice, In-Memory ML Model & Persistent Repository"
      icon={Shield}
      className="mb-4"
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        {/* ML Model In-Memory State */}
        <div
          style={{
            padding: '14px',
            backgroundColor: 'var(--bg-canvas)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Cpu size={15} />
            <span>LSTM MODEL ENGINE</span>
          </div>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: isHealthy ? 'var(--healthy-main)' : 'var(--critical-main)',
              marginTop: '6px',
            }}
          >
            {health?.model_loaded ? 'Resident In Memory' : 'Not Loaded'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Version: {health?.model_version || 'N/A'}
          </div>
        </div>

        {/* Feature Scaler */}
        <div
          style={{
            padding: '14px',
            backgroundColor: 'var(--bg-canvas)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Sliders size={15} />
            <span>FEATURE NORMALIZER</span>
          </div>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: health?.scaler_loaded ? 'var(--healthy-main)' : 'var(--warning-main)',
              marginTop: '6px',
            }}
          >
            {health?.scaler_loaded ? 'Fitted Scaler Ready' : 'Degraded'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Dimensions: {health?.features_count || 14} active channels
          </div>
        </div>

        {/* Sliding Window */}
        <div
          style={{
            padding: '14px',
            backgroundColor: 'var(--bg-canvas)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Layers size={15} />
            <span>TEMPORAL WINDOW</span>
          </div>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--text-main)',
              marginTop: '6px',
            }}
          >
            {health?.sequence_length || 30} Operational Cycles
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Zero-padded for cycles &lt; 30
          </div>
        </div>

        {/* Supabase Repository */}
        <div
          style={{
            padding: '14px',
            backgroundColor: 'var(--bg-canvas)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Database size={15} />
            <span>DATABASE STORAGE</span>
          </div>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color:
                health?.database_connected && health?.database_type === 'supabase'
                  ? 'var(--healthy-main)'
                  : 'var(--text-main)',
              marginTop: '6px',
            }}
          >
            {health?.database_type === 'supabase'
              ? 'Supabase Cloud (Live)'
              : 'In-Memory Fallback'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {health?.database_connected ? 'Persistent UUID Storage' : 'Session Memory'}
          </div>
        </div>
      </div>
    </Card>
  );
}
