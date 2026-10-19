import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import ExplanationPanel from '../components/prediction/ExplanationPanel';
import FleetSchedulerCard from '../components/maintenance/FleetSchedulerCard';
import EngineRulCard from '../components/prediction/EngineRulCard';

describe('Phase 4 Frontend Components', () => {
  describe('ExplanationPanel Component', () => {
    const mockExplanation = {
      attribution_method: 'Gradient-Based Input Sensitivity & Trend Drift',
      method_limitation_note: 'Traditional KernelSHAP flattens 3D temporal sequences (30 x 14 = 420 dims) and breaks Keras dynamic graph hooks.',
      feature_attributions: {
        sensor_2: 15.2,
        sensor_3: 12.8,
        sensor_4: 10.5,
        sensor_7: 8.4,
      },
      top_contributing_sensors: [
        {
          sensor: 'sensor_2',
          name: 'T24',
          full_name: 'LPC Outlet Temperature',
          unit: '°R',
          subsystem: 'Low-Pressure Compressor',
          attribution_percent: 15.2,
          trend_direction: 'increasing',
          trend_slope: 0.045,
          drift_severity: 'HIGH',
        },
      ],
      sensor_trends: {
        sensor_2: {
          name: 'T24',
          full_name: 'LPC Outlet Temperature',
          unit: '°R',
          subsystem: 'Low-Pressure Compressor',
          latest_value: 642.5,
          trend_slope_per_cycle: 0.045,
          trend_direction: 'increasing',
          z_score_deviation: 2.35,
          drift_severity: 'HIGH',
        },
      },
    };

    it('renders feature attribution title and methodology', () => {
      render(<ExplanationPanel explanation={mockExplanation} engineId={1} />);

      expect(screen.getByText(/Explainability & Feature Attribution — Engine #1/i)).toBeInTheDocument();
      expect(screen.getByText(/Gradient-Based Input Sensitivity/i)).toBeInTheDocument();
      expect(screen.getByText(/Top Degradation Drivers/i)).toBeInTheDocument();
      expect(screen.getAllByText(/LPC Outlet Temperature/i).length).toBeGreaterThan(0);
    });

    it('toggles SHAP limitation disclosure note', () => {
      render(<ExplanationPanel explanation={mockExplanation} engineId={1} />);

      const toggleBtn = screen.getByRole('button', { name: /Why Gradient Tape over SHAP/i });
      expect(toggleBtn).toBeInTheDocument();

      fireEvent.click(toggleBtn);
      expect(screen.getByText(/Traditional KernelSHAP flattens 3D temporal sequences/i)).toBeInTheDocument();
    });
  });

  describe('FleetSchedulerCard Component', () => {
    const mockScheduleData = {
      total_engines: 2,
      hangar_capacity: 2,
      lead_time_cycles: 5,
      total_slots: 1,
      bottleneck_warning: 'Warning: Immediate critical engines exceed available hangar capacity.',
      tie_breaking_policy: 'Deterministic Multi-Criteria: (1) Priority Tier, (2) Lowest RUL, (3) Cycles, (4) Engine ID.',
      schedule: [
        {
          engine_id: 1,
          priority: 'P1_IMMEDIATE',
          risk_level: 'CRITICAL',
          predicted_rul: 18.5,
          current_cycle: 192,
          slot_number: 1,
          scheduled_cycle_target: 195,
          estimated_downtime_cycles: 5,
          scheduling_rationale: 'Rank #1 (P1_IMMEDIATE). Scheduled into Slot 1.',
        },
      ],
    };

    it('renders fleet scheduler table, slot allocations, and bottleneck banner', () => {
      const onCreateOrder = vi.fn();
      render(
        <FleetSchedulerCard
          scheduleData={mockScheduleData}
          onUpdateCapacity={vi.fn()}
          onCreateWorkOrder={onCreateOrder}
        />
      );

      expect(screen.getByText(/Fleet Maintenance Scheduling & Capacity Allocation/i)).toBeInTheDocument();
      expect(screen.getByText(/CAPACITY BOTTLENECK DETECTED/i)).toBeInTheDocument();
      expect(screen.getByText(/Unit #1/i)).toBeInTheDocument();
      expect(screen.getAllByText(/P1_IMMEDIATE/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Bay Slot 1/i)).toBeInTheDocument();

      const createBtn = screen.getByRole('button', { name: /Create Work Order/i });
      fireEvent.click(createBtn);
      expect(onCreateOrder).toHaveBeenCalledWith(mockScheduleData.schedule[0]);
    });
  });

  describe('EngineRulCard Phase 4 Enhancements', () => {
    const mockPrediction = {
      engine_id: 42,
      current_cycle: 160,
      cycles_analyzed: 160,
      predicted_rul: 15.0,
      risk_level: 'CRITICAL',
      priority: 'P1_IMMEDIATE',
      recommendation: 'Ground engine for hot-section borescope inspection.',
      padded_sequence: false,
      database_id: 'd9b8a7c6-1234-5678-9abc-def012345678',
      maintenance_recommendation: {
        priority: 'P1_IMMEDIATE',
        action: 'Conduct hot-section borescope inspection and replace HPC stage seals.',
        reason: 'RUL has decreased to 15.0 cycles below safety threshold.',
        human_review_required: true,
        policy_rule: 'RULE_CRITICAL_IMMEDIATE_DISPATCH_LIMIT',
      },
    };

    it('renders priority badge, human review requirement, and prototype disclaimer', () => {
      render(<EngineRulCard prediction={mockPrediction} />);

      expect(screen.getByText(/PRIORITY P1 IMMEDIATE/i)).toBeInTheDocument();
      expect(screen.getByText(/Human Review Required/i)).toBeInTheDocument();
      expect(screen.getByText(/Conduct hot-section borescope inspection/i)).toBeInTheDocument();
      expect(screen.getByText(/Policy: RULE_CRITICAL_IMMEDIATE_DISPATCH_LIMIT/i)).toBeInTheDocument();
      expect(screen.getByText(/NOT a certified aviation airworthiness or dispatch limit/i)).toBeInTheDocument();
    });
  });
});
