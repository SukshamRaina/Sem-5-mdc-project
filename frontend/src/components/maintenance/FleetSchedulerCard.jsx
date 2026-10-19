import React, { useState } from 'react';
import {
  Calendar,
  Info,
  Sliders,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import Card from '../common/Card';
import Badge from '../common/Badge';

export default function FleetSchedulerCard({
  scheduleData,
  onUpdateCapacity,
  onCreateWorkOrder,
  isLoading = false,
}) {
  const [hangarCapacity, setHangarCapacity] = useState(
    scheduleData?.hangar_capacity || 2
  );
  const [leadTimeCycles, setLeadTimeCycles] = useState(
    scheduleData?.lead_time_cycles || 5
  );

  const handleApplyConstraints = (e) => {
    e.preventDefault();
    if (onUpdateCapacity) {
      onUpdateCapacity(Number(hangarCapacity), Number(leadTimeCycles));
    }
  };

  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case 'P1_IMMEDIATE':
        return 'badge-critical';
      case 'P2_URGENT':
        return 'badge-warning';
      case 'P3_ROUTINE':
        return 'badge-moderate';
      case 'P4_DEFERRED':
      default:
        return 'badge-healthy';
    }
  };

  const schedule = scheduleData?.schedule || [];
  const bottleneckWarning = scheduleData?.bottleneck_warning;
  const policyDoc = scheduleData?.tie_breaking_policy;

  return (
    <Card
      title="Fleet Maintenance Scheduling & Capacity Allocation"
      subtitle="Deterministic multi-criteria engine prioritization under concurrent hangar bay limits"
      icon={Calendar}
    >
      {/* Constraints Controls Form */}
      <form
        onSubmit={handleApplyConstraints}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          gap: '16px',
          padding: '16px',
          backgroundColor: 'var(--bg-canvas)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-light)',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', marginBottom: '4px' }}>
          <Sliders size={14} style={{ color: 'var(--primary-600)' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
            Hangar & Depot Capacity Constraints
          </span>
        </div>

        <div>
          <label
            htmlFor="hangar-capacity-input"
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}
          >
            Hangar Bay Capacity (Concurrent Bays)
          </label>
          <input
            id="hangar-capacity-input"
            type="number"
            min="1"
            max="10"
            value={hangarCapacity}
            onChange={(e) => setHangarCapacity(e.target.value)}
            style={{
              width: '140px',
              padding: '6px 10px',
              fontSize: '13px',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-card)',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="lead-time-input"
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}
          >
            Service Lead Time Buffer (Cycles)
          </label>
          <input
            id="lead-time-input"
            type="number"
            min="0"
            max="30"
            value={leadTimeCycles}
            onChange={(e) => setLeadTimeCycles(e.target.value)}
            style={{
              width: '140px',
              padding: '6px 10px',
              fontSize: '13px',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-card)',
            }}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading}
          style={{ height: '34px', fontSize: '12px' }}
        >
          {isLoading ? 'Optimizing...' : 'Recalculate Slot Allocation'}
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Fleet Units</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
              {scheduleData?.total_engines || schedule.length}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Required Slots</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary-700)' }}>
              {scheduleData?.total_slots || 0}
            </div>
          </div>
        </div>
      </form>

      {/* Bottleneck Alert */}
      {bottleneckWarning && (
        <div
          style={{
            marginBottom: '18px',
            padding: '12px 16px',
            backgroundColor: 'var(--critical-bg)',
            border: '1px solid var(--critical-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <ShieldAlert size={20} style={{ color: 'var(--critical-main)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--critical-text)' }}>
              CAPACITY BOTTLENECK DETECTED
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-body)', marginTop: '2px' }}>
              {bottleneckWarning}
            </div>
          </div>
        </div>
      )}

      {/* Tie-Breaking Policy Accordion/Note */}
      <div
        style={{
          marginBottom: '16px',
          padding: '10px 14px',
          backgroundColor: 'var(--bg-card-subtle)',
          borderRadius: 'var(--radius-md)',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Info size={14} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
        <span>
          <strong>Prioritization Logic:</strong> {policyDoc || 'Deterministic Multi-Criteria: (1) Priority Tier, (2) Lowest RUL, (3) Highest Accumulated Flight Cycles, (4) Engine ID ascending.'}
        </span>
      </div>

      {/* Prioritized Maintenance Slot Table */}
      {schedule.length === 0 ? (
        <div className="empty-state">
          <Info size={28} className="empty-state-icon" />
          <p>No fleet schedule generated. Upload engine telemetry to evaluate maintenance priority.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Engine Unit</th>
                <th>Priority Tier</th>
                <th>Risk Category</th>
                <th>Est. RUL</th>
                <th>Assigned Slot</th>
                <th>Target Cycle</th>
                <th>Scheduling Rationale</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((item, idx) => (
                <tr key={item.engine_id}>
                  <td style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>
                    #{idx + 1}
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '13px' }}>
                      Unit #{item.engine_id}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Cycle {item.current_cycle}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${getPriorityBadgeClass(item.priority)}`} style={{ fontSize: '11px' }}>
                      {item.priority}
                    </span>
                  </td>
                  <td>
                    <Badge level={item.risk_level} />
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px' }}>
                    {item.predicted_rul.toFixed(1)} cyc
                  </td>
                  <td>
                    <div
                      style={{
                        padding: '3px 8px',
                        backgroundColor: 'var(--primary-50)',
                        border: '1px solid var(--primary-100)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--primary-800)',
                        fontWeight: 700,
                        fontSize: '11px',
                        display: 'inline-block',
                      }}
                    >
                      Bay Slot {item.slot_number}
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600 }}>
                    Cycle &le; {item.scheduled_cycle_target}
                  </td>
                  <td style={{ fontSize: '11px', color: 'var(--text-body)', maxWidth: '280px' }}>
                    {item.scheduling_rationale}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                      onClick={() => onCreateWorkOrder && onCreateWorkOrder(item)}
                    >
                      <Wrench size={12} style={{ marginRight: '4px' }} />
                      Create Work Order
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
