import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

describe('App Dashboard Full Integration', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders overview with live backend state and clearly labeled metrics', async () => {
    const mockHealth = {
      status: 'healthy',
      model_loaded: true,
      scaler_loaded: true,
      model_version: 'lstm-stacked-v1.0',
      features_count: 14,
      sequence_length: 30,
      database_connected: true,
      database_type: 'supabase',
      timestamp: '2026-10-19T12:00:00Z',
    };

    const mockHistory = {
      items: [
        {
          id: 'uuid-1',
          engine_id: 1,
          current_cycle: 31,
          cycles_analyzed: 31,
          predicted_rul: 113.0,
          risk_level: 'HEALTHY',
          recommendation: 'Operating nominal',
          created_at: '2026-10-19T16:00:00Z',
        },
      ],
      total: 24,
      page: 1,
      page_size: 20,
      total_pages: 2,
    };

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/health')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockHealth,
        });
      }
      if (url.includes('/predictions')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockHistory,
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(<App />);

    // Health indicators
    await waitFor(() => {
      expect(screen.getByText('Backend Live')).toBeInTheDocument();
    });

    // Overview section distinction
    expect(screen.getByText('Active Batch Fleet Summary')).toBeInTheDocument();
    expect(screen.getByText('Awaiting Ingestion')).toBeInTheDocument();
    expect(
      screen.getByText('No Active Inference Results in Current Session')
    ).toBeInTheDocument();

    // Database activity section
    expect(screen.getByText('Database Historical Records Activity')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument(); // total in database
    expect(screen.getByText('LOADED RECORDS (PAGE 1)')).toBeInTheDocument();
  });

  it('navigates to History tab and displays database records with retry button', async () => {
    const mockHealth = {
      status: 'healthy',
      model_loaded: true,
      scaler_loaded: true,
      database_connected: true,
      database_type: 'supabase',
    };

    let fetchCount = 0;
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/health')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockHealth,
        });
      }
      if (url.includes('/predictions')) {
        fetchCount++;
        if (fetchCount === 1) {
          // Simulate initial error
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Error',
            json: async () => ({ detail: 'Database connection timeout' }),
          });
        }
        // Recover on retry
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 'uuid-rec',
                engine_id: 1,
                current_cycle: 31,
                cycles_analyzed: 31,
                predicted_rul: 113.0,
                risk_level: 'HEALTHY',
                created_at: '2026-10-19T16:00:00Z',
              },
            ],
            total: 1,
            page: 1,
            page_size: 20,
            total_pages: 1,
          }),
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<App />);

    // Click History tab
    fireEvent.click(screen.getByText('Prediction History'));

    // Verify initial error message
    await waitFor(() => {
      expect(
        screen.getByText(/Failed to load prediction history/i)
      ).toBeInTheDocument();
    });

    // Click Refresh to retry
    fireEvent.click(screen.getByText('Refresh'));

    // Verify recovery and record display
    await waitFor(() => {
      expect(screen.getByText('Engine #1')).toBeInTheDocument();
      expect(screen.getByText('113')).toBeInTheDocument();
    });
  });
});
