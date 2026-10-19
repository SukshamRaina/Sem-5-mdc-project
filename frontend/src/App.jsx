import React, { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import {
  Activity,
  ArrowRight,
  Database,
  FileText,
  Play,
  RotateCcw,
  Sparkles,
  UploadCloud,
} from 'lucide-react';

// API Services
import {
  getHealth,
  predictFromCsv,
  getPredictions,
} from './services/api';

// Layout Components
import Header from './components/layout/Header';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

// Common Components
import Alert from './components/common/Alert';
import Card from './components/common/Card';
import LoadingSpinner from './components/common/LoadingSpinner';

// Dashboard Components
import SystemHealthCard from './components/dashboard/SystemHealthCard';
import FleetSummaryCards from './components/dashboard/FleetSummaryCards';
import QuickGuideCard from './components/dashboard/QuickGuideCard';

// Upload Components
import FileUploadZone from './components/upload/FileUploadZone';
import FilePreviewCard from './components/upload/FilePreviewCard';
import SampleFileSelector from './components/upload/SampleFileSelector';

// Prediction & Analytics Components
import EngineSelector from './components/prediction/EngineSelector';
import EngineRulCard from './components/prediction/EngineRulCard';
import TrajectoryChart from './components/prediction/TrajectoryChart';
import SensorTelemetryChart from './components/prediction/SensorTelemetryChart';

// History Components
import HistoryFilters from './components/history/HistoryFilters';
import HistoryTable from './components/history/HistoryTable';
import HistoryPagination from './components/history/HistoryPagination';

const RAW_COLUMN_NAMES = [
  'unit_number',
  'time_cycles',
  'setting_1',
  'setting_2',
  'setting_3',
  'sensor_1',
  'sensor_2',
  'sensor_3',
  'sensor_4',
  'sensor_5',
  'sensor_6',
  'sensor_7',
  'sensor_8',
  'sensor_9',
  'sensor_10',
  'sensor_11',
  'sensor_12',
  'sensor_13',
  'sensor_14',
  'sensor_15',
  'sensor_16',
  'sensor_17',
  'sensor_18',
  'sensor_19',
  'sensor_20',
  'sensor_21',
];

export default function App() {
  // Navigation & Health State
  const [activeTab, setActiveTab] = useState('overview');
  const [health, setHealth] = useState(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // Upload & File State
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileRowCount, setFileRowCount] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);

  // Prediction Response State
  const [predictionResponse, setPredictionResponse] = useState(null);
  const [selectedEngineId, setSelectedEngineId] = useState(null);
  const [parsedSensorDataByEngine, setParsedSensorDataByEngine] = useState({});

  // History State
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(20);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyEngineFilter, setHistoryEngineFilter] = useState('');
  const [historyRiskFilter, setHistoryRiskFilter] = useState('ALL');
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  // Check Backend Health
  const checkHealthStatus = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      const data = await getHealth();
      setHealth(data);
    } catch (err) {
      console.warn('Backend health check error:', err);
      setHealth(null);
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  // Fetch History Records
  const fetchHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await getPredictions({
        page: historyPage,
        pageSize: historyPageSize,
        engineId: historyEngineFilter || null,
        riskLevel: historyRiskFilter,
      });
      setHistoryRecords(data.items || []);
      setHistoryTotal(data.total || 0);
      setHistoryTotalPages(data.total_pages || 1);
    } catch (err) {
      setHistoryError(err.message || 'Failed to retrieve prediction records.');
    } finally {
      setIsHistoryLoading(false);
    }
  }, [historyPage, historyPageSize, historyEngineFilter, historyRiskFilter]);

  // Initial Load
  useEffect(() => {
    checkHealthStatus();
    fetchHistory();
  }, [checkHealthStatus, fetchHistory]);

  // Parse Uploaded CSV File locally to extract real sensor observation values for visualization
  const parseLocalFileForSensorCurves = (file) => {
    if (!file) return;

    Papa.parse(file, {
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) return;

        const rows = results.data;
        const firstRow = rows[0];
        const isHeaderRow =
          typeof firstRow[0] === 'string' &&
          (firstRow[0].toLowerCase().includes('unit') ||
            firstRow.some((col) => String(col).toLowerCase().includes('sensor')));

        let parsedRows = [];

        if (isHeaderRow) {
          const headers = firstRow.map((h) => String(h).trim().toLowerCase());
          for (let i = 1; i < rows.length; i++) {
            const rowObj = {};
            headers.forEach((h, idx) => {
              rowObj[h] = rows[i][idx];
            });
            parsedRows.push(rowObj);
          }
        } else {
          // Space or delimited raw NASA C-MAPSS rows (26 columns)
          for (let i = 0; i < rows.length; i++) {
            const raw = rows[i];
            const rowObj = {};
            RAW_COLUMN_NAMES.forEach((colName, idx) => {
              rowObj[colName] = raw[idx];
            });
            parsedRows.push(rowObj);
          }
        }

        // Set row count
        setFileRowCount(parsedRows.length);

        // Group by engine unit_number
        const grouped = {};
        parsedRows.forEach((r) => {
          const unit = r.unit_number || 1;
          const cycle = r.time_cycles || r.cycle || 1;
          if (!grouped[unit]) grouped[unit] = [];

          // Format clean row for Recharts
          const chartRow = {
            cycle: Number(cycle),
            unit_number: Number(unit),
          };

          // Attach all numeric sensor readings
          Object.keys(r).forEach((k) => {
            if (k.startsWith('sensor_') && typeof r[k] === 'number') {
              chartRow[k] = r[k];
            }
          });

          grouped[unit].push(chartRow);
        });

        // Sort each engine's points by cycle
        Object.keys(grouped).forEach((unit) => {
          grouped[unit].sort((a, b) => a.cycle - b.cycle);
        });

        setParsedSensorDataByEngine(grouped);
      },
      error: (err) => {
        console.warn('Local CSV parse warning:', err);
      },
    });
  };

  // Handle File Selection
  const handleFileSelected = (file) => {
    setSelectedFile(file);
    setUploadError(null);
    parseLocalFileForSensorCurves(file);
  };

  // Handle Submit Prediction to POST /predict
  const handleSubmitPrediction = async () => {
    if (!selectedFile) {
      setUploadError('Please select or drag a CSV telemetry file to predict.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    setUploadError(null);

    try {
      const response = await predictFromCsv(selectedFile, true, (progress) => {
        setUploadProgress(progress);
      });

      setPredictionResponse(response);

      // Auto-select first engine
      if (response.predictions && response.predictions.length > 0) {
        setSelectedEngineId(response.predictions[0].engine_id);
      }

      // Refresh database history
      fetchHistory();

      // Switch to results tab to display predictions
      setActiveTab('results');
    } catch (err) {
      console.error('Inference error:', err);
      setUploadError(
        err.message || 'Prediction failed. Check that all 14 required sensor channels exist in the CSV.'
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Selected engine prediction object
  const currentEnginePrediction =
    predictionResponse?.predictions?.find(
      (p) => p.engine_id === selectedEngineId
    ) || predictionResponse?.predictions?.[0];

  const currentEngineSensorData =
    selectedEngineId && parsedSensorDataByEngine[selectedEngineId]
      ? parsedSensorDataByEngine[selectedEngineId]
      : parsedSensorDataByEngine[Object.keys(parsedSensorDataByEngine)[0]] || [];

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        health={health}
        isCheckingHealth={isCheckingHealth}
        onRefreshHealth={checkHealthStatus}
      />

      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasActivePrediction={!!predictionResponse}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {/* TAB 1: FLEET OVERVIEW */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  letterSpacing: '-0.01em',
                }}
              >
                Turbofan Fleet Status & System Health
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Real-time operational dashboard for NASA C-MAPSS FD001 engine degradation analysis.
              </p>
            </div>

            {/* Live Backend & ML State */}
            <SystemHealthCard health={health} isCheckingHealth={isCheckingHealth} />

            {/* Fleet KPI Metric Cards */}
            <div style={{ margin: '24px 0 8px 0' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
                  Fleet Health Overview
                </h3>
                {predictionResponse && (
                  <span
                    className="badge badge-neutral"
                    style={{ textTransform: 'none', fontWeight: 500 }}
                  >
                    Based on latest inference run ({predictionResponse.fleet_summary.total_engines} engines)
                  </span>
                )}
              </div>

              <FleetSummaryCards
                summary={
                  predictionResponse
                    ? predictionResponse.fleet_summary
                    : {
                        total_engines: historyTotal > 0 ? historyTotal : 0,
                        critical_count: historyRecords.filter((r) => r.risk_level === 'CRITICAL').length,
                        warning_count: historyRecords.filter((r) => r.risk_level === 'WARNING').length,
                        moderate_count: historyRecords.filter((r) => r.risk_level === 'MODERATE').length,
                        healthy_count: historyRecords.filter((r) => r.risk_level === 'HEALTHY').length,
                        avg_rul:
                          historyRecords.length > 0
                            ? Math.round(
                                (historyRecords.reduce((acc, r) => acc + r.predicted_rul, 0) /
                                  historyRecords.length) *
                                  10
                              ) / 10
                            : 0,
                        min_rul:
                          historyRecords.length > 0
                            ? Math.min(...historyRecords.map((r) => r.predicted_rul))
                            : 0,
                      }
                }
              />
            </div>

            {/* Quick Action Navigation Buttons */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
                margin: '24px 0',
              }}
            >
              <div
                onClick={() => setActiveTab('predict')}
                style={{
                  padding: '16px 20px',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-xs)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                }}
                className="card"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary-50)',
                      color: 'var(--primary-700)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <UploadCloud size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      Predict Remaining Useful Life
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Upload sensor CSV to generate real-time RUL
                    </div>
                  </div>
                </div>
                <ArrowRight size={18} style={{ color: 'var(--primary-700)' }} />
              </div>

              <div
                onClick={() => setActiveTab('history')}
                style={{
                  padding: '16px 20px',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-xs)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                }}
                className="card"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--healthy-bg)',
                      color: 'var(--healthy-text)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Database size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      View Prediction Database Logs
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Review persistent records stored in Supabase
                    </div>
                  </div>
                </div>
                <ArrowRight size={18} style={{ color: 'var(--primary-700)' }} />
              </div>
            </div>

            {/* Prognostics Reference Guide */}
            <QuickGuideCard />
          </div>
        )}

        {/* TAB 2: TELEMETRY & PREDICTION */}
        {activeTab === 'predict' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  letterSpacing: '-0.01em',
                }}
              >
                Telemetry Ingestion & RUL Prediction
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Upload flight sensor observations to execute real-time LSTM neural inference.
              </p>
            </div>

            {uploadError && (
              <Alert
                type="danger"
                title="Telemetry Validation / Inference Error"
                onClose={() => setUploadError(null)}
              >
                {uploadError}
              </Alert>
            )}

            <Card
              title="Select or Upload Engine Sensor Data"
              subtitle="Accepts standard comma-delimited CSV with sensor headers or raw 26-column C-MAPSS space-separated format"
              icon={UploadCloud}
            >
              {/* Drop Zone */}
              <FileUploadZone
                onFileSelected={handleFileSelected}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                disabled={isUploading}
              />

              {/* Selected File Card */}
              {selectedFile && (
                <FilePreviewCard
                  file={selectedFile}
                  rowCount={fileRowCount}
                  onRemove={() => {
                    setSelectedFile(null);
                    setFileRowCount(null);
                  }}
                  onReplace={() => {
                    setSelectedFile(null);
                    setFileRowCount(null);
                  }}
                  disabled={isUploading}
                />
              )}

              {/* Action Buttons */}
              <div
                style={{
                  marginTop: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Payload target: <code>POST /predict</code> &bull; Real ML Pipeline &bull; Saved to Database
                </div>

                <button
                  type="button"
                  onClick={handleSubmitPrediction}
                  disabled={!selectedFile || isUploading}
                  className="btn btn-primary btn-lg"
                >
                  {isUploading ? (
                    <LoadingSpinner inline size={16} text="Executing Inference..." />
                  ) : (
                    <>
                      <Play size={16} />
                      <span>Execute RUL Prediction</span>
                    </>
                  )}
                </button>
              </div>

              {/* Pre-validated test samples for easy evaluation */}
              <SampleFileSelector
                onSelectSample={handleFileSelected}
                disabled={isUploading}
              />
            </Card>
          </div>
        )}

        {/* TAB 3: RESULTS & SENSOR ANALYTICS */}
        {activeTab === 'results' && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '20px',
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Prediction Results & Degradation Analysis
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Evaluated with Stacked LSTM ({predictionResponse?.model_version || health?.model_version || 'lstm-stacked-v1.0'}).
                </p>
              </div>

              <button
                onClick={() => setActiveTab('predict')}
                className="btn btn-secondary btn-sm"
              >
                <RotateCcw size={13} />
                <span>Upload Another File</span>
              </button>
            </div>

            {!predictionResponse ? (
              <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                <Activity size={36} className="empty-state-icon" />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>
                  No Prediction Active in Current Session
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0 20px 0' }}>
                  Upload a sensor telemetry CSV file or select a C-MAPSS sample to view remaining useful life estimations.
                </p>
                <button
                  onClick={() => setActiveTab('predict')}
                  className="btn btn-primary"
                >
                  <UploadCloud size={16} />
                  <span>Go to Upload Page</span>
                </button>
              </div>
            ) : (
              <div>
                {/* Multi-Engine Selector (if fleet CSV) */}
                <EngineSelector
                  predictions={predictionResponse.predictions}
                  selectedEngineId={selectedEngineId}
                  onSelectEngine={setSelectedEngineId}
                />

                {/* Single Engine RUL Card */}
                <EngineRulCard prediction={currentEnginePrediction} />

                {/* Recharts Trajectory & Sensor Visualizations */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Trajectory Degradation Curve */}
                  <TrajectoryChart
                    trajectory={currentEnginePrediction?.trajectory}
                    engineId={currentEnginePrediction?.engine_id}
                  />

                  {/* Physical Sensor Telemetry Trends */}
                  <SensorTelemetryChart
                    sensorData={currentEngineSensorData}
                    engineId={currentEnginePrediction?.engine_id}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PREDICTION HISTORY */}
        {activeTab === 'history' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  letterSpacing: '-0.01em',
                }}
              >
                Historical Prediction Records
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Persistent inference records retrieved from the database repository.
              </p>
            </div>

            {/* Filter controls */}
            <HistoryFilters
              engineId={historyEngineFilter}
              onEngineIdChange={setHistoryEngineFilter}
              riskLevel={historyRiskFilter}
              onRiskLevelChange={setHistoryRiskFilter}
              totalRecords={historyTotal}
              isLoading={isHistoryLoading}
              onRefresh={fetchHistory}
            />

            {/* Table */}
            <HistoryTable
              records={historyRecords}
              isLoading={isHistoryLoading}
              error={historyError}
            />

            {/* Pagination */}
            {historyTotal > 0 && (
              <HistoryPagination
                currentPage={historyPage}
                totalPages={historyTotalPages}
                pageSize={historyPageSize}
                onPageChange={setHistoryPage}
                onPageSizeChange={(newSize) => {
                  setHistoryPageSize(newSize);
                  setHistoryPage(1);
                }}
                disabled={isHistoryLoading}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
