import { describe, it, expect } from 'vitest';
import { parseTelemetry } from '../utils/telemetryParser';

describe('telemetryParser', () => {
  it('parses original NASA C-MAPSS space-separated 26-column data without headers', async () => {
    // 2 cycles for Engine 1
    const rawData = [
      '1 1 -0.0007 -0.0004 100.0 518.67 641.82 1589.70 1400.60 14.62 21.61 554.36 2388.06 9046.19 1.30 47.47 521.66 2388.02 8138.62 8.4195 0.03 392 2388 100.00 39.06 23.4190',
      '1 2 0.0019 -0.0003 100.0 518.67 642.15 1591.82 1403.14 14.62 21.61 553.75 2388.04 9044.07 1.30 47.49 522.28 2388.07 8131.49 8.4318 0.03 392 2388 100.00 39.00 23.4236',
    ].join('\n');

    const result = await parseTelemetry(rawData);
    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(2);
    expect(result.engineIds).toEqual([1]);
    expect(result.enginesData[1].length).toBe(2);
    expect(result.enginesData[1][0].cycle).toBe(1);
    expect(result.enginesData[1][0].unit_number).toBe(1);
    expect(result.enginesData[1][0].sensor_2).toBe(641.82);
    expect(result.enginesData[1][1].cycle).toBe(2);
    expect(result.enginesData[1][1].sensor_2).toBe(642.15);
  });

  it('parses CSV data with headers', async () => {
    const csvData = [
      'unit_number,time_cycles,setting_1,setting_2,setting_3,sensor_2,sensor_4,sensor_11',
      '1,10,-0.0001,0.0002,100.0,642.5,1405.2,554.1',
      '1,11,-0.0002,0.0001,100.0,642.8,1406.1,553.9',
    ].join('\n');

    const result = await parseTelemetry(csvData);
    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(2);
    expect(result.engineIds).toEqual([1]);
    expect(result.enginesData[1][0].cycle).toBe(10);
    expect(result.enginesData[1][0].sensor_2).toBe(642.5);
    expect(result.enginesData[1][1].cycle).toBe(11);
    expect(result.enginesData[1][1].sensor_11).toBe(553.9);
  });

  it('correctly groups multiple engines and sorts observations by cycle', async () => {
    // Deliberately out-of-order cycles across 2 engines
    const rawData = [
      '2 5 -0.0001 0.0002 100.0 518.67 642.0 1590.0 1400.0 14.62 21.61 554.0 2388.0 9045.0 1.30 47.5 522.0 2388.0 8135.0 8.42 0.03 392 2388 100.0 39.0 23.4',
      '1 3 -0.0001 0.0002 100.0 518.67 642.0 1590.0 1400.0 14.62 21.61 554.0 2388.0 9045.0 1.30 47.5 522.0 2388.0 8135.0 8.42 0.03 392 2388 100.0 39.0 23.4',
      '2 1 -0.0001 0.0002 100.0 518.67 642.0 1590.0 1400.0 14.62 21.61 554.0 2388.0 9045.0 1.30 47.5 522.0 2388.0 8135.0 8.42 0.03 392 2388 100.0 39.0 23.4',
      '1 1 -0.0001 0.0002 100.0 518.67 642.0 1590.0 1400.0 14.62 21.61 554.0 2388.0 9045.0 1.30 47.5 522.0 2388.0 8135.0 8.42 0.03 392 2388 100.0 39.0 23.4',
    ].join('\n');

    const result = await parseTelemetry(rawData);
    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(4);
    expect(result.engineIds).toEqual([1, 2]);

    // Engine 1 sorted
    expect(result.enginesData[1][0].cycle).toBe(1);
    expect(result.enginesData[1][1].cycle).toBe(3);

    // Engine 2 sorted
    expect(result.enginesData[2][0].cycle).toBe(1);
    expect(result.enginesData[2][1].cycle).toBe(5);
  });

  it('handles empty input gracefully', async () => {
    const result = await parseTelemetry('   \n\n  ');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/empty/i);
    expect(result.rowCount).toBe(0);
  });

  it('skips malformed rows and warns instead of assigning to fallback Engine 1 or Cycle 1', async () => {
    const rawData = [
      '1 1 -0.0007 -0.0004 100.0 518.67 641.82 1589.70 1400.60 14.62 21.61 554.36 2388.06 9046.19 1.30 47.47 521.66 2388.02 8138.62 8.4195 0.03 392 2388 100.00 39.06 23.4190',
      'CORRUPT_ROW INVALID_DATA',
      '1 2 -0.0007 -0.0004 100.0 518.67 641.82 1589.70 1400.60 14.62 21.61 554.36 2388.06 9046.19 1.30 47.47 521.66 2388.02 8138.62 8.4195 0.03 392 2388 100.00 39.06 23.4190',
    ].join('\n');

    const result = await parseTelemetry(rawData);
    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(2); // Only the 2 valid rows
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/skipped 1 invalid or malformed row/i);
  });
});
