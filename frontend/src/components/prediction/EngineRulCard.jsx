import React from 'react';
import {
  Database,
  Gauge,
  Info,
  Wrench,
} from 'lucide-react';
import Badge from '../common/Badge';
import { getRiskInfo } from '../../constants/sensorMetadata';

export default function EngineRulCard({ prediction }) {
  if (!prediction) {
    return (
      <div className="card" style={{ padding: '36px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>
          No prediction selected. Upload a CSV to view Remaining Useful Life estimations.
        </p>
      </div>
    );
  }

  const {
    engine_id,
    current_cycle,
    cycles_analyzed,
    predicted_rul,
    risk_level,
    recommendation,
    padded_sequence,
    database_id,
    priority,
    risk_assessment,
    maintenance_recommendation,
  } = prediction;

  const riskInfo = getRiskInfo(risk_level);
  const activePriority = priority || maintenance_recommendation?.priority || 'P3_ROUTINE';
  const recAction = maintenance_recommendation?.action || recommendation || riskInfo.description;
  const recReason = maintenance_recommendation?.reason;
  const policyRule = maintenance_recommendation?.policy_rule;

  const getPriorityStyle = (p) => {
    switch (p) {
      case 'P1_IMMEDIATE':
        return { bg: 'var(--critical-bg)', color: 'var(--critical-text)', border: 'var(--critical-border)', label: 'P1 IMMEDIATE' };
      case 'P2_URGENT':
        return { bg: 'var(--warning-bg)', color: 'var(--warning-text)', border: 'var(--warning-border)', label: 'P2 URGENT' };
      case 'P3_ROUTINE':
        return { bg: 'var(--moderate-bg)', color: 'var(--moderate-text)', border: 'var(--moderate-border)', label: 'P3 ROUTINE' };
      case 'P4_DEFERRED':
      default:
        return { bg: 'var(--healthy-bg)', color: 'var(--healthy-text)', border: 'var(--healthy-border)', label: 'P4 DEFERRED' };
    }
  };

  const priorityStyle = getPriorityStyle(activePriority);

  return (
    <div
      className="card"
      style={{
        borderLeft: `5px solid ${riskInfo.color}`,
        marginBottom: '20px',
      }}
    >
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--bg-canvas)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: '14px',
              color: 'var(--text-main)',
            }}
          >
            Engine Unit #{engine_id}
          </div>
          <Badge level={risk_level} />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: priorityStyle.bg,
              color: priorityStyle.color,
              border: `1px solid ${priorityStyle.border}`,
            }}
          >
            PRIORITY {priorityStyle.label}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--primary-50)',
              color: 'var(--primary-800)',
              border: '1px solid var(--primary-100)',
            }}
          >
            Human Review Required
          </span>
          {padded_sequence && (
            <span
              className="badge badge-warning"
              title="Observation history is less than the 30-cycle sliding window. Preceding cycles were zero-padded."
            >
              Zero-Padded (&lt;30 cycles)
            </span>
          )}
        </div>

        {database_id && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'var(--font-mono)',
            }}
            title="Persistent Supabase UUID"
          >
            <Database size={12} />
            <span>ID: {database_id.slice(0, 8)}...</span>
          </div>
        )}
      </div>

      <div className="card-body">
        {/* Model Prediction vs Decision Support Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
            alignItems: 'center',
          }}
        >
          {/* Main RUL Display */}
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Gauge size={14} />
              <span>ESTIMATED REMAINING USEFUL LIFE (RUL)</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '8px',
                margin: '8px 0 4px 0',
              }}
            >
              <span
                style={{
                  fontSize: '44px',
                  fontWeight: 800,
                  color: riskInfo.color,
                  lineHeight: 1,
                  fontFeatureSettings: '"tnum"',
                }}
              >
                {predicted_rul}
              </span>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}
              >
                operational cycles
              </span>
            </div>

            <p
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Info size={12} />
              <span>
                Model statistical estimate &bull; NASA C-MAPSS FD001 Trained Stacked LSTM
              </span>
            </p>
          </div>

          {/* Operational Cycle Telemetry Metrics */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              padding: '16px',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-light)',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                Current Flight Cycle
              </div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginTop: '2px',
                }}
              >
                {current_cycle}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Latest observed point
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                Cycles Submitted
              </div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginTop: '2px',
                }}
              >
                {cycles_analyzed}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Processed observations
              </div>
            </div>
          </div>
        </div>

        {/* Engineering Recommendation Box */}
        <div
          style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: riskInfo.bgColor,
            border: `1px solid ${riskInfo.borderColor}`,
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <Wrench
              size={18}
              style={{ color: riskInfo.color, marginTop: '2px', flexShrink: 0 }}
            />
            <div style={{ width: '100%' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: '4px',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: riskInfo.color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  ENGINEERING MAINTENANCE ADVISORY &bull; {priorityStyle.label}
                </div>
                {policyRule && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    Policy: {policyRule}
                  </div>
                )}
              </div>

              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--text-main)',
                  lineHeight: 1.5,
                  fontWeight: 600,
                }}
              >
                {recAction}
              </div>

              {recReason && (
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-body)',
                    marginTop: '6px',
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Technical Justification:</strong> {recReason}
                </div>
              )}

              {/* Academic Non-Certification Prototype Notice */}
              <div
                style={{
                  marginTop: '10px',
                  paddingTop: '8px',
                  borderTop: `1px dashed ${riskInfo.borderColor}`,
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  fontStyle: 'italic',
                }}
              >
                Notice: Prototype research heuristic. NOT a certified aviation airworthiness or dispatch limit. Must be confirmed by licensed A&P / Part 66 maintenance engineers.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
