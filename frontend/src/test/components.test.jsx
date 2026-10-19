import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Components
import Header from '../components/layout/Header';
import Navbar from '../components/layout/Navbar';
import EngineRulCard from '../components/prediction/EngineRulCard';
import FleetSummaryCards from '../components/dashboard/FleetSummaryCards';
import HistoryTable from '../components/history/HistoryTable';

describe('Frontend React Components', () => {
  describe('Header Component', () => {
    it('renders project title and live backend status indicator', () => {
      const mockHealth = {
        status: 'healthy',
        model_loaded: true,
        database_connected: true,
        database_type: 'supabase',
        model_version: 'lstm-stacked-v1.0',
      };

      render(
        <Header
          health={mockHealth}
          isCheckingHealth={false}
          onRefreshHealth={vi.fn()}
        />
      );

      expect(
        screen.getByText('NASA C-MAPSS Predictive Maintenance')
      ).toBeInTheDocument();
      expect(screen.getByText('Backend Live')).toBeInTheDocument();
      expect(screen.getByText('Supabase DB')).toBeInTheDocument();
      expect(screen.getByText('LSTM Regressor')).toBeInTheDocument();
    });

    it('renders degraded status when backend is degraded', () => {
      render(
        <Header
          health={{ status: 'degraded' }}
          isCheckingHealth={false}
          onRefreshHealth={vi.fn()}
        />
      );
      expect(screen.getByText('Degraded')).toBeInTheDocument();
    });

    it('renders offline status when backend is unreachable', () => {
      render(
        <Header
          health={null}
          isCheckingHealth={false}
          onRefreshHealth={vi.fn()}
        />
      );
      expect(screen.getByText('Backend Offline')).toBeInTheDocument();
    });
  });

  describe('Navbar Component', () => {
    it('renders all four primary navigation tabs', () => {
      const onTabChange = vi.fn();
      render(
        <Navbar
          activeTab="overview"
          onTabChange={onTabChange}
          hasActivePrediction={false}
        />
      );

      expect(screen.getByText('Fleet Overview')).toBeInTheDocument();
      expect(screen.getByText('Telemetry & Prediction')).toBeInTheDocument();
      expect(screen.getByText('Results & Sensor Analytics')).toBeInTheDocument();
      expect(screen.getByText('Prediction History')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Telemetry & Prediction'));
      expect(onTabChange).toHaveBeenCalledWith('predict');
    });

    it('displays active badge on Results tab when inference response exists', () => {
      render(
        <Navbar
          activeTab="results"
          onTabChange={vi.fn()}
          hasActivePrediction={true}
        />
      );
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  describe('EngineRulCard Component', () => {
    it('displays real predicted RUL, unit, and recommendation advisory', () => {
      const mockPrediction = {
        engine_id: 1,
        current_cycle: 31,
        cycles_analyzed: 31,
        predicted_rul: 113.0,
        risk_level: 'HEALTHY',
        recommendation:
          'Turbofan engine operating within nominal degradation tolerances.',
        padded_sequence: false,
        database_id: 'd3ae2f09-c4ca-4972-9235-85b8c565377a',
      };

      render(<EngineRulCard prediction={mockPrediction} />);

      expect(screen.getByText('Engine Unit #1')).toBeInTheDocument();
      expect(screen.getByText('113')).toBeInTheDocument();
      expect(screen.getByText(/operational cycles/i)).toBeInTheDocument();
      expect(screen.getByText(/nominal degradation tolerances/i)).toBeInTheDocument();
      expect(screen.getAllByText('31').length).toBeGreaterThanOrEqual(1);
    });

    it('displays padded sequence indicator when sequence length < 30', () => {
      const mockPrediction = {
        engine_id: 5,
        current_cycle: 12,
        cycles_analyzed: 12,
        predicted_rul: 85.0,
        risk_level: 'HEALTHY',
        recommendation: 'Nominal wear',
        padded_sequence: true,
      };

      render(<EngineRulCard prediction={mockPrediction} />);
      expect(screen.getByText(/Zero-Padded/i)).toBeInTheDocument();
    });
  });

  describe('FleetSummaryCards Component', () => {
    it('renders real fleet summary metrics when prediction response is present', () => {
      const mockSummary = {
        total_engines: 2,
        critical_count: 0,
        warning_count: 1,
        moderate_count: 0,
        healthy_count: 1,
        min_rul: 42.0,
        avg_rul: 77.5,
        highest_risk_engine_id: 2,
      };

      render(<FleetSummaryCards summary={mockSummary} />);

      expect(screen.getByText('Engines Evaluated')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('77.5')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('Engine #2 highest risk')).toBeInTheDocument();
    });

    it('renders awaiting ingestion state when summary is null', () => {
      render(<FleetSummaryCards summary={null} onNavigateToUpload={vi.fn()} />);

      expect(
        screen.getByText('No Active Inference Results in Current Session')
      ).toBeInTheDocument();
      expect(screen.getByText('Upload Telemetry File')).toBeInTheDocument();
    });
  });

  describe('HistoryTable Component', () => {
    it('renders prediction records table with details button', () => {
      const records = [
        {
          id: '037d96b9-f691-4f26-a28f-a8e146f23450',
          engine_id: 1,
          current_cycle: 31,
          cycles_analyzed: 31,
          predicted_rul: 113.0,
          risk_level: 'HEALTHY',
          recommendation: 'Operating nominal',
          created_at: '2026-10-19T16:37:36Z',
        },
      ];

      render(<HistoryTable records={records} isLoading={false} error={null} />);

      expect(screen.getByText('Engine #1')).toBeInTheDocument();
      expect(screen.getByText('113')).toBeInTheDocument();
      expect(screen.getByText('Details')).toBeInTheDocument();
    });

    it('renders empty state when records array is empty', () => {
      render(<HistoryTable records={[]} isLoading={false} error={null} />);
      expect(screen.getByText('No prediction history found')).toBeInTheDocument();
    });

    it('renders loading spinner when isLoading is true', () => {
      render(<HistoryTable records={[]} isLoading={true} error={null} />);
      expect(
        screen.getByText(/Retrieving prediction logs/i)
      ).toBeInTheDocument();
    });
  });
});
