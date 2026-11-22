/**
 * NASA C-MAPSS Benchmark & Multi-Dataset Evaluation Constants
 * Audited empirical performance metrics and training convergence histories
 * across FD001, FD002, FD003, and FD004.
 */

import historyData from './historyData.json';

export const CMAPSS_BENCHMARKS = [
  {
    dataset: 'FD001',
    operatingConditions: 1,
    conditionDescription: 'Sea Level (Nominal)',
    faultModes: 1,
    faultDescription: 'HPC Degradation',
    trainUnits: 100,
    testUnits: 100,
    features: 14,
    regimeClustering: 'None (Static)',
    testRmse: 14.335,
    testMae: 10.328,
    testR2: 0.8810,
    testNasaScore: 327.81,
    meanWearRate: '5.3e-5',
    bestValEpoch: 16,
    valLoss: 172.42,
  },
  {
    dataset: 'FD002',
    operatingConditions: 6,
    conditionDescription: 'Alt 0–42kft, Mach 0–0.84, TRA 60–100%',
    faultModes: 1,
    faultDescription: 'HPC Degradation',
    trainUnits: 260,
    testUnits: 259,
    features: 18,
    regimeClustering: '6-Cluster KMeans (Zero Leakage)',
    testRmse: 25.854,
    testMae: 16.983,
    testR2: 0.7689,
    testNasaScore: 6559.40,
    meanWearRate: '0.0537',
    bestValEpoch: 12,
    valLoss: 226.14,
  },
  {
    dataset: 'FD003',
    operatingConditions: 1,
    conditionDescription: 'Sea Level (Nominal)',
    faultModes: 2,
    faultDescription: 'HPC + Fan Degradation',
    trainUnits: 100,
    testUnits: 100,
    features: 15,
    regimeClustering: 'None (Static)',
    testRmse: 13.103,
    testMae: 9.356,
    testR2: 0.8998,
    testNasaScore: 324.07,
    meanWearRate: '4.0e-6',
    bestValEpoch: 23,
    valLoss: 110.11,
  },
  {
    dataset: 'FD004',
    operatingConditions: 6,
    conditionDescription: 'Alt 0–42kft, Mach 0–0.84, TRA 60–100%',
    faultModes: 2,
    faultDescription: 'HPC + Fan Degradation',
    trainUnits: 249,
    testUnits: 248,
    features: 19,
    regimeClustering: '6-Cluster KMeans (Zero Leakage)',
    testRmse: 25.910,
    testMae: 17.925,
    testR2: 0.7742,
    testNasaScore: 6053.31,
    meanWearRate: '0.0320',
    bestValEpoch: 17,
    valLoss: 135.31,
  },
];

export const LSTM_BASELINE_COMPARISON = {
  rawTargets: [
    { metric: 'RMSE (Cycles)', lstm: 14.493, pinn: 14.335, delta: -0.158, deltaPercent: -1.1, winner: 'PINN' },
    { metric: 'MAE (Cycles)', lstm: 11.244, pinn: 10.328, delta: -0.916, deltaPercent: -8.1, winner: 'PINN' },
    { metric: 'R² Score', lstm: 0.8784, pinn: 0.8810, delta: 0.0026, deltaPercent: 0.3, winner: 'PINN' },
    { metric: 'NASA PHM Score', lstm: 319.76, pinn: 327.81, delta: 8.05, deltaPercent: 2.5, winner: 'LSTM' },
  ],
  clippedTargets: [
    { metric: 'RMSE (Cycles)', lstm: 13.097, pinn: 12.762, delta: -0.335, deltaPercent: -2.6, winner: 'PINN' },
    { metric: 'MAE (Cycles)', lstm: 10.174, pinn: 9.258, delta: -0.916, deltaPercent: -9.0, winner: 'PINN' },
    { metric: 'R² Score', lstm: 0.8932, pinn: 0.8986, delta: 0.0054, deltaPercent: 0.6, winner: 'PINN' },
    { metric: 'NASA PHM Score', lstm: 280.94, pinn: 273.82, delta: -7.12, deltaPercent: -2.5, winner: 'PINN' },
  ],
};

export const TRAINING_HISTORIES = historyData;

export const METRIC_DEFINITIONS = [
  {
    name: 'Root Mean Squared Error (RMSE)',
    symbol: 'RMSE',
    formula: '\\sqrt{\\frac{1}{N} \\sum_{i=1}^N (y_i - \\hat{y}_i)^2}',
    unit: 'Cycles',
    interpretation: 'Measures standard deviation of prediction errors. Penalizes large outliers heavily.',
    lowerIsBetter: true,
  },
  {
    name: 'Mean Absolute Error (MAE)',
    symbol: 'MAE',
    formula: '\\frac{1}{N} \\sum_{i=1}^N |y_i - \\hat{y}_i|',
    unit: 'Cycles',
    interpretation: 'Average linear magnitude of errors across all test units. Robust to single extreme outliers.',
    lowerIsBetter: true,
  },
  {
    name: 'Coefficient of Determination (R²)',
    symbol: 'R²',
    formula: '1 - \\frac{\\sum (y_i - \\hat{y}_i)^2}{\\sum (y_i - \\bar{y})^2}',
    unit: 'Dimensionless (0 to 1)',
    interpretation: 'Fraction of total RUL variance explained by the neural network relative to mean baseline.',
    lowerIsBetter: false,
  },
  {
    name: 'NASA PHM 2008 Asymmetric Score',
    symbol: 'Score (S)',
    formula: 'S = \\sum_{i=1}^N \\begin{cases} e^{-d_i/13}-1 & d_i < 0 \\text{ (Early)} \\\\ e^{d_i/10}-1 & d_i \\ge 0 \\text{ (Late)} \\end{cases}',
    unit: 'Asymmetric Penalty Units',
    interpretation: 'Official PHM Challenge metric. Exponentially penalizes late predictions (dangerous) more severely than early predictions (safe).',
    lowerIsBetter: true,
  },
];
