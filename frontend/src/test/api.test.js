import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getHealth,
  predictFromCsv,
  getPredictions,
  ApiError,
} from '../services/api';

describe('API Service Layer', () => {
  const originalFetch = globalThis.fetch;
  const originalXHR = globalThis.XMLHttpRequest;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.XMLHttpRequest = originalXHR;
  });

  describe('getHealth', () => {
    it('successfully retrieves health payload from backend', async () => {
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

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockHealth,
      });

      const result = await getHealth();
      expect(result.status).toBe('healthy');
      expect(result.model_loaded).toBe(true);
      expect(result.database_type).toBe('supabase');
    });

    it('throws ApiError when backend is unreachable or returns error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      await expect(getHealth()).rejects.toThrow(ApiError);
    });
  });

  describe('predictFromCsv validation', () => {
    it('rejects if no file is selected', async () => {
      await expect(predictFromCsv(null)).rejects.toThrow(
        /No file selected/i
      );
    });

    it('rejects unsupported file extensions', async () => {
      const badFile = new File(['data'], 'telemetry.pdf', { type: 'application/pdf' });
      await expect(predictFromCsv(badFile)).rejects.toThrow(
        /Invalid file format/i
      );
    });

    it('rejects empty files (0 bytes)', async () => {
      const emptyFile = new File([], 'empty.csv', { type: 'text/csv' });
      await expect(predictFromCsv(emptyFile)).rejects.toThrow(
        /Selected file is empty/i
      );
    });

    it('rejects files exceeding 10 MB limit', async () => {
      const largeFile = {
        name: 'large_telemetry.csv',
        size: 11 * 1024 * 1024,
      };
      await expect(predictFromCsv(largeFile)).rejects.toThrow(
        /exceeds maximum allowable limit of 10 MB/i
      );
    });

    it('submits valid file via XMLHttpRequest and returns prediction response', async () => {
      const mockResponse = {
        success: true,
        message: 'Prediction successful',
        fleet_summary: {
          total_engines: 1,
          critical_count: 0,
          warning_count: 0,
          moderate_count: 0,
          healthy_count: 1,
          min_rul: 113.0,
          avg_rul: 113.0,
          highest_risk_engine_id: 1,
        },
        predictions: [
          {
            engine_id: 1,
            current_cycle: 31,
            cycles_analyzed: 31,
            predicted_rul: 113.0,
            risk_level: 'HEALTHY',
            recommendation: 'Operating normally',
            padded_sequence: false,
            trajectory: [{ cycle: 31, predicted_rul: 113.0, risk_level: 'HEALTHY' }],
          },
        ],
      };

      class MockXHR {
        constructor() {
          this.upload = {};
          this.headers = {};
        }
        open(method, url) {
          this.method = method;
          this.url = url;
        }
        setRequestHeader(k, v) {
          this.headers[k] = v;
        }
        send() {
          this.status = 200;
          this.responseText = JSON.stringify(mockResponse);
          this.onload();
        }
      }

      globalThis.XMLHttpRequest = MockXHR;

      const validFile = new File(['valid csv content'], 'engine_1.csv', { type: 'text/csv' });
      const result = await predictFromCsv(validFile, true);

      expect(result.success).toBe(true);
      expect(result.predictions[0].predicted_rul).toBe(113.0);
      expect(result.predictions[0].risk_level).toBe('HEALTHY');
    });

    it('handles HTTP 422 validation error from backend', async () => {
      class MockErrorXHR {
        constructor() {
          this.upload = {};
        }
        open() {}
        setRequestHeader() {}
        send() {
          this.status = 422;
          this.responseText = JSON.stringify({
            detail: "Missing 14 required sensor column(s): ['sensor_2', ...]",
          });
          this.onload();
        }
      }

      globalThis.XMLHttpRequest = MockErrorXHR;

      const file = new File(['invalid'], 'bad.csv', { type: 'text/csv' });
      await expect(predictFromCsv(file)).rejects.toThrow(
        /Missing 14 required sensor column/i
      );
    });
  });

  describe('getPredictions', () => {
    it('builds query parameters and returns paginated predictions', async () => {
      const mockData = {
        items: [
          {
            id: 'uuid-1234',
            engine_id: 1,
            current_cycle: 31,
            predicted_rul: 113.0,
            risk_level: 'HEALTHY',
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      const result = await getPredictions({ page: 1, pageSize: 20, engineId: 1, riskLevel: 'HEALTHY' });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=1&page_size=20&engine_id=1&risk_level=HEALTHY'),
        expect.any(Object)
      );
      expect(result.items.length).toBe(1);
      expect(result.items[0].predicted_rul).toBe(113.0);
    });
  });
});
