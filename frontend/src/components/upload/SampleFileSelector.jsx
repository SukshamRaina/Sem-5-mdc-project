import React from 'react';
import { Download, PlayCircle, Sparkles } from 'lucide-react';

export default function SampleFileSelector({ onSelectSample, disabled }) {
  const samples = [
    {
      id: 'fd001_engine_1',
      title: 'FD001 Engine #1 (31 Cycles)',
      description: 'Single-condition (Sea Level) HPC wear series in nominal health.',
      fileName: 'sample_FD001_engine_1.csv',
      path: '/samples/sample_FD001_engine_1.csv',
      badge: 'FD001 Standard',
    },
    {
      id: 'fd002_engine_1',
      title: 'FD002 Engine #1 (35 Cycles)',
      description: 'Multi-condition profile cycling across 6 flight operating regimes.',
      fileName: 'sample_FD002_engine_1.csv',
      path: '/samples/sample_FD002_engine_1.csv',
      badge: 'FD002 6-Regimes',
    },
    {
      id: 'fd003_engine_1',
      title: 'FD003 Engine #1 (35 Cycles)',
      description: 'Sea Level baseline with coupled HPC and Fan degradation modes.',
      fileName: 'sample_FD003_engine_1.csv',
      path: '/samples/sample_FD003_engine_1.csv',
      badge: 'FD003 Dual-Fault',
    },
    {
      id: 'fd004_engine_1',
      title: 'FD004 Engine #1 (35 Cycles)',
      description: 'Complex multi-regime flight profile with dual HPC + Fan fault modes.',
      fileName: 'sample_FD004_engine_1.csv',
      path: '/samples/sample_FD004_engine_1.csv',
      badge: 'FD004 Full Complex',
    },
    {
      id: 'near_failure',
      title: 'FD001 Near-Failure Engine',
      description: 'Late-stage degraded telemetry approaching critical life threshold.',
      fileName: 'sample_engine_near_failure.csv',
      path: '/samples/sample_engine_near_failure.csv',
      badge: 'Critical Tier',
    },
    {
      id: 'multi_engine',
      title: 'FD001 Fleet (Engines #1 & #2)',
      description: 'Multi-engine fleet dataset containing 80 operational flight cycles.',
      fileName: 'sample_multi_engine.csv',
      path: '/samples/sample_multi_engine.csv',
      badge: 'Fleet Multi-Unit',
    },
    {
      id: 'invalid_missing_sensors',
      title: 'Invalid: Missing Sensor Columns (Test Error)',
      description: 'Telemetry file missing required sensor columns to test HTTP 422 handling.',
      fileName: 'sample_invalid_missing_sensors.csv',
      path: '/samples/sample_invalid_missing_sensors.csv',
      badge: 'Invalid 422 Test',
    },
  ];

  const handleLoadSample = async (sample) => {
    try {
      const response = await fetch(sample.path);
      if (!response.ok) {
        throw new Error(`Failed to load ${sample.fileName}`);
      }
      const blob = await response.blob();
      const file = new File([blob], sample.fileName, { type: 'text/csv' });
      onSelectSample(file);
    } catch (err) {
      console.error('Error fetching sample file:', err);
    }
  };

  return (
    <div
      style={{
        marginTop: '20px',
        padding: '16px',
        backgroundColor: 'var(--bg-canvas)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={16} style={{ color: 'var(--primary-700)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
            Quick Test: Load Pre-Validated NASA C-MAPSS Datasets
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Standard FD001 Format
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '12px',
        }}
      >
        {samples.map((sample) => (
          <div
            key={sample.id}
            style={{
              padding: '12px 14px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-xs)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                  {sample.title}
                </span>
                <span className="badge badge-neutral" style={{ fontSize: '9px' }}>
                  {sample.badge}
                </span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {sample.description}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => handleLoadSample(sample)}
                disabled={disabled}
                className="btn btn-outline-primary btn-sm"
                style={{ flex: 1, padding: '5px 8px' }}
              >
                <PlayCircle size={13} />
                <span>Load & Test</span>
              </button>
              <a
                href={sample.path}
                download={sample.fileName}
                className="btn btn-secondary btn-sm"
                style={{ padding: '5px 8px' }}
                title="Download CSV file"
              >
                <Download size={13} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
