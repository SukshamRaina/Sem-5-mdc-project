import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  BarChart3,
  TrendingDown,
  Award,
  Layers,
  Activity,
  HelpCircle,
  Sliders,
} from 'lucide-react';
import Card from '../common/Card';
import {
  CMAPSS_BENCHMARKS,
  LSTM_BASELINE_COMPARISON,
  TRAINING_HISTORIES,
  METRIC_DEFINITIONS,
} from '../../constants/benchmarkData';

export default function AnalyticsView() {
  const [selectedMetric, setSelectedMetric] = useState('testRmse');
  const [selectedHistoryDataset, setSelectedHistoryDataset] = useState('FD001');
  const [baselineTargetMode, setBaselineTargetMode] = useState('raw'); // 'raw' or 'clipped'

  const metricConfigs = {
    testRmse: { label: 'Test RMSE', unit: 'Cycles', color: '#38bdf8', lowerIsBetter: true },
    testMae: { label: 'Test MAE', unit: 'Cycles', color: '#818cf8', lowerIsBetter: true },
    testR2: { label: 'R² Correlation', unit: 'Score', color: '#34d399', lowerIsBetter: false },
    testNasaScore: { label: 'NASA PHM Score', unit: 'Penalty', color: '#f59e0b', lowerIsBetter: true },
  };

  const currentMetricConfig = metricConfigs[selectedMetric];

  // Benchmark chart data
  const comparisonData = CMAPSS_BENCHMARKS.map((b) => ({
    dataset: b.dataset,
    value: b[selectedMetric],
    conditions: b.operatingConditions,
    faults: b.faultModes,
    features: b.features,
    units: b.testUnits,
  }));

  // Loss curves history
  const activeHistory = TRAINING_HISTORIES[selectedHistoryDataset] || [];

  // Baseline comparison data
  const baselineData =
    baselineTargetMode === 'raw'
      ? LSTM_BASELINE_COMPARISON.rawTargets
      : LSTM_BASELINE_COMPARISON.clippedTargets;

  const renderBarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="recharts-custom-tooltip">
          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
            Dataset: {item.dataset}
          </div>
          <div style={{ color: currentMetricConfig.color, fontWeight: 600, margin: '4px 0' }}>
            {currentMetricConfig.label}: {item.value} {currentMetricConfig.unit}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Operating Regimes: {item.conditions} &bull; Faults: {item.faults}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Test Engines: {item.units} &bull; Active Features: {item.features}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div>
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--text-main)',
            letterSpacing: '-0.01em',
          }}
        >
          Model Performance & Multi-Dataset Evaluation
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Audited empirical benchmarks, baseline comparative validation, and physics-constrained convergence dynamics across NASA C-MAPSS.
        </p>
      </div>

      {/* 4 Summary Cards of Benchmark Achievements */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '16px',
        }}
      >
        <div className="stat-card">
          <div className="stat-label">
            <span>Best Prediction Precision</span>
            <Award size={16} style={{ color: 'var(--healthy-main)' }} />
          </div>
          <div className="stat-value" style={{ color: 'var(--healthy-main)' }}>
            13.10
            <span className="stat-unit">RMSE (FD003)</span>
          </div>
          <div className="stat-meta">
            9.36 MAE &bull; Dual fault modes (Fan + HPC)
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <span>Highest Correlation</span>
            <Activity size={16} style={{ color: 'var(--moderate-main)' }} />
          </div>
          <div className="stat-value" style={{ color: 'var(--moderate-main)' }}>
            0.8998
            <span className="stat-unit">R² (FD003)</span>
          </div>
          <div className="stat-meta">
            FD001: 0.8810 &bull; FD004: 0.7742
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <span>Best NASA PHM Score</span>
            <TrendingDown size={16} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>
            324.07
            <span className="stat-unit">Score (FD003)</span>
          </div>
          <div className="stat-meta">
            FD001: 327.81 &bull; Lower asymmetric penalty
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <span>Total Evaluated Units</span>
            <Layers size={16} style={{ color: 'var(--text-main)' }} />
          </div>
          <div className="stat-value">
            707
            <span className="stat-unit">Engines</span>
          </div>
          <div className="stat-meta">
            100 (FD001), 259 (FD002), 100 (FD003), 248 (FD004)
          </div>
        </div>
      </div>

      {/* Section 1: Official Test Benchmark Matrix */}
      <Card
        title="NASA C-MAPSS Official Test Benchmarks (FD001–FD004)"
        subtitle="Evaluated on held-out test splits using official ground-truth end-of-life targets (RUL_FD00X.txt)"
        icon={BarChart3}
      >
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Flight Regimes</th>
                <th>Fault Modes</th>
                <th>Test Units</th>
                <th>Features</th>
                <th>Test RMSE</th>
                <th>Test MAE</th>
                <th>R² Score</th>
                <th>NASA Score</th>
                <th>Best Val Epoch</th>
              </tr>
            </thead>
            <tbody>
              {CMAPSS_BENCHMARKS.map((b) => (
                <tr key={b.dataset}>
                  <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    {b.dataset}
                  </td>
                  <td>{b.conditionDescription}</td>
                  <td>{b.faultDescription}</td>
                  <td style={{ fontWeight: 600 }}>{b.testUnits}</td>
                  <td>{b.features}</td>
                  <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    {b.testRmse.toFixed(3)}
                  </td>
                  <td>{b.testMae.toFixed(3)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--healthy-main)' }}>
                    {b.testR2.toFixed(4)}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--warning-main)' }}>
                    {b.testNasaScore.toFixed(2)}
                  </td>
                  <td>Epoch {b.bestValEpoch}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Section 2: Interactive Comparative Bar Chart */}
      <Card
        title="Cross-Dataset Benchmark Comparison"
        subtitle="Compare accuracy, error metrics, and NASA challenge scores across all four C-MAPSS subsets"
        icon={Sliders}
        action={
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Object.entries(metricConfigs).map(([key, config]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedMetric(key)}
                className={`btn btn-sm ${selectedMetric === key ? 'btn-primary' : 'btn-secondary'}`}
              >
                {config.label}
              </button>
            ))}
          </div>
        }
      >
        <div style={{ height: '260px', width: '100%', marginTop: '10px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis dataKey="dataset" stroke="var(--text-secondary)" fontSize={12} tickLine={false} />
              <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} />
              <Tooltip content={renderBarTooltip} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill={currentMetricConfig.color}>
                {comparisonData.map((entry, index) => (
                  <Cell
                    key={`bar-${index}`}
                    fill={entry.dataset === 'FD003' ? '#10b981' : currentMetricConfig.color}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', textAlign: 'center' }}>
          *Note: Multi-condition sets (FD002 & FD004) incorporate 6 operating flight regimes and complex transitions.
        </div>
      </Card>

      {/* Section 3: Baseline Comparison (PINN vs Legacy LSTM) */}
      <Card
        title="Baseline Comparison on FD001 (Legacy Stacked LSTM vs. PINN)"
        subtitle="Audited on identical FD001 test engines across both raw unclipped and 125-clipped target conventions"
        icon={Layers}
        action={
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setBaselineTargetMode('raw')}
              className={`btn btn-sm ${baselineTargetMode === 'raw' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Raw Targets
            </button>
            <button
              type="button"
              onClick={() => setBaselineTargetMode('clipped')}
              className={`btn btn-sm ${baselineTargetMode === 'clipped' ? 'btn-primary' : 'btn-secondary'}`}
            >
              125-Clipped Targets
            </button>
          </div>
        }
      >
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Evaluation Metric</th>
                <th>Legacy Stacked LSTM</th>
                <th>Physics-Informed PINN</th>
                <th>Improvement / Delta</th>
                <th>Benchmark Superiority</th>
              </tr>
            </thead>
            <tbody>
              {baselineData.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.metric}</td>
                  <td>{row.lstm.toFixed(row.metric.includes('R²') ? 4 : 3)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    {row.pinn.toFixed(row.metric.includes('R²') ? 4 : 3)}
                  </td>
                  <td style={{ color: row.delta < 0 ? 'var(--healthy-main)' : 'var(--text-secondary)' }}>
                    {row.delta > 0 ? `+${row.delta.toFixed(3)}` : row.delta.toFixed(3)} ({row.deltaPercent}%)
                  </td>
                  <td>
                    <span
                      className={`badge ${row.winner === 'PINN' ? 'badge-healthy' : 'badge-warning'}`}
                    >
                      {row.winner}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-light)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: 'var(--text-main)' }}>Academic Transparency Note on NASA Score:</strong> The NASA PHM 2008 scoring metric exponentially penalizes late predictions (y_pred &gt; y_true) via exp(d/10)-1 versus early predictions via exp(-d/13)-1. While the PINN achieves superior overall precision (lower RMSE, lower MAE, higher R²), the legacy LSTM achieved a slightly lower NASA score (319.76 vs 327.81) on raw targets due to more conservative skew on a handful of high-RUL engines. Under the 125-clipped target convention, the PINN outperforms the baseline on all 4 metrics.
        </div>
      </Card>

      {/* Section 4: Training & Validation Convergence Curves */}
      <Card
        title={`PINN Training & Validation Convergence (${selectedHistoryDataset})`}
        subtitle="Per-epoch loss decomposition showing data loss, physics residual loss, monotonicity loss, and validation RMSE"
        icon={Activity}
        action={
          <div style={{ display: 'flex', gap: '6px' }}>
            {['FD001', 'FD002', 'FD003', 'FD004'].map((ds) => (
              <button
                key={ds}
                type="button"
                onClick={() => setSelectedHistoryDataset(ds)}
                className={`btn btn-sm ${selectedHistoryDataset === ds ? 'btn-primary' : 'btn-secondary'}`}
              >
                {ds}
              </button>
            ))}
          </div>
        }
      >
        <div style={{ height: '300px', width: '100%', marginTop: '10px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={activeHistory} margin={{ top: 15, right: 25, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis dataKey="epoch" stroke="var(--text-secondary)" fontSize={12} tickLine={false} label={{ value: 'Epoch', position: 'insideBottomRight', offset: -5, fill: 'var(--text-secondary)' }} />
              <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="recharts-custom-tooltip">
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                          Epoch {data.epoch} ({selectedHistoryDataset})
                        </div>
                        <div style={{ color: '#38bdf8' }}>Total Loss: {data.loss}</div>
                        <div style={{ color: '#818cf8' }}>Supervised Data Loss: {data.loss_data}</div>
                        <div style={{ color: '#34d399' }}>Physics Loss (L_phys): {data.loss_physics}</div>
                        <div style={{ color: '#f59e0b' }}>Monotonicity Loss (L_mono): {data.loss_mono}</div>
                        <div style={{ color: '#f87171' }}>Validation Loss: {data.val_loss}</div>
                        <div style={{ color: '#cbd5e1', fontWeight: 600, marginTop: '2px' }}>
                          Validation RMSE: {data.val_rmse} cycles
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="loss" name="Total Loss" stroke="#38bdf8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="val_loss" name="Validation Loss" stroke="#f87171" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="val_rmse" name="Val RMSE (Cycles)" stroke="#34d399" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Section 5: Technical Metric Explanations */}
      <Card
        title="Prognostic Evaluation Metric Reference"
        subtitle="Mathematical formulation and industrial interpretation of NASA C-MAPSS metrics"
        icon={HelpCircle}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
          }}
        >
          {METRIC_DEFINITIONS.map((def, idx) => (
            <div
              key={idx}
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-light)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                  {def.name}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    color: 'var(--accent-cyan)',
                  }}
                >
                  {def.unit}
                </span>
              </div>
              <div
                style={{
                  margin: '8px 0',
                  padding: '6px 10px',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: 'var(--radius-xs)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--accent-cyan)',
                }}
              >
                {def.symbol} &bull; {def.lowerIsBetter ? 'Lower is better (↓)' : 'Higher is better (↑)'}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {def.interpretation}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
