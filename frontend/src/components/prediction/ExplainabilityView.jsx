import React from 'react';
import {
  Brain,
  Info,
  Activity,
} from 'lucide-react';
import Card from '../common/Card';
import ExplanationPanel from './ExplanationPanel';

export default function ExplainabilityView({
  predictionResponse,
  selectedEngineId,
  onSelectEngine,
  onNavigateToUpload,
}) {
  const predictions = predictionResponse?.predictions || [];
  const currentPrediction =
    predictions.find((p) => p.engine_id === selectedEngineId) || predictions[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Title */}
      <div>
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--text-main)',
            letterSpacing: '-0.01em',
          }}
        >
          Physics-Informed Model Explainability & Sensor Sensitivity
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Exact gradient tape input sensitivity attributions, sensor drift trajectory rates, and turbofan subsystem mappings.
        </p>
      </div>

      {/* Disclaimers & Methodological Boundaries */}
      <div
        style={{
          padding: '14px 18px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'rgba(14, 165, 233, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <Info size={20} style={{ color: 'var(--accent-cyan)', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--text-body)' }}>
          <strong style={{ color: 'var(--text-main)' }}>Directional Sensitivity vs. Causal Intervention:</strong>{' '}
          Subsystem attributions are evaluated via exact automatic differentiation input gradients (grad_X(RUL) = dRUL/dX) across the active TensorFlow computational graph (&lt;15ms latency). They identify which telemetry channels locally drive the instantaneous prediction at the current flight regime; they do not represent counterfactual causal mechanisms or replace physical teardown inspections.
        </div>
      </div>

      {!currentPrediction ? (
        <Card
          title="No Active Prediction Session"
          subtitle="Execute inference on a telemetry CSV file to view real-time gradient attribution"
          icon={Brain}
        >
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <Activity size={36} style={{ color: 'var(--text-secondary)', margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
              Awaiting Engine Inference Data
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '6px 0 18px 0' }}>
              Upload telemetry or select a C-MAPSS sample file to generate live feature attributions.
            </p>
            {onNavigateToUpload && (
              <button
                type="button"
                onClick={onNavigateToUpload}
                className="btn btn-primary"
              >
                Go to Upload & Ingestion
              </button>
            )}
          </div>
        </Card>
      ) : (
        <>
          {/* Multi-Engine Selector for Fleets */}
          {predictions.length > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                Select Engine Unit to Inspect:
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {predictions.map((p) => (
                  <button
                    key={p.engine_id}
                    type="button"
                    onClick={() => onSelectEngine(p.engine_id)}
                    className={`btn btn-sm ${
                      (currentPrediction.engine_id === p.engine_id)
                        ? 'btn-primary'
                        : 'btn-secondary'
                    }`}
                  >
                    Engine #{p.engine_id} ({p.risk_level})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Explanation Panel */}
          <ExplanationPanel
            explanation={currentPrediction.explanation}
            engineId={currentPrediction.engine_id}
          />
        </>
      )}
    </div>
  );
}
