import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  ArrowRight,
  Play,
  RotateCcw,
  UploadCloud,
  Layers,
} from 'lucide-react';

// API Services
import {
  getHealth,
  predictFromCsv,
  getPredictions,
  getFleetSchedule,
} from './services/api';

// Parsing Utility
import { parseTelemetry } from './utils/telemetryParser';

// Layout Components
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

// Common Components
import Alert from './components/common/Alert';
import Card from './components/common/Card';
import LoadingSpinner from './components/common/LoadingSpinner';

// Dashboard Components
import SystemHealthCard from './components/dashboard/SystemHealthCard';
import FleetSummaryCards from './components/dashboard/FleetSummaryCards';
import FleetAnalyticsOverview from './components/dashboard/FleetAnalyticsOverview';
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
import ExplanationPanel from './components/prediction/ExplanationPanel';
import ExplainabilityView from './components/prediction/ExplainabilityView';
import AnalyticsView from './components/analytics/AnalyticsView';
import ProjectInfoView from './components/project/ProjectInfoView';

// Maintenance & Optimization Components
import FleetSchedulerCard from './components/maintenance/FleetSchedulerCard';
import MaintenanceRecordsView from './components/maintenance/MaintenanceRecordsView';

// History Components
import HistoryFilters from './components/history/HistoryFilters';
import HistoryTable from './components/history/HistoryTable';
import HistoryPagination from './components/history/HistoryPagination';

export default function App() {
  // Navigation & Health State
  const [activeTab, setActiveTab] = useState('overview');
  const [health, setHealth] = useState(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Upload & File State
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileRowCount, setFileRowCount] = useState(null);
  const [selectedDataset, setSelectedDataset] = useState('FD001');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [parserNotice, setParserNotice] = useState(null);

  // Prediction Response State
  const [predictionResponse, setPredictionResponse] = useState(null);
  const [selectedEngineId, setSelectedEngineId] = useState(null);
  const [parsedSensorDataByEngine, setParsedSensorDataByEngine] = useState({});

  // Fleet Scheduling & Maintenance State
  const [fleetSchedule, setFleetSchedule] = useState(null);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [workOrderPreFill, setWorkOrderPreFill] = useState(null);

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

  // Telemetry parser for local observation curves
  const parseLocalFileForSensorCurves = async (file) => {
    if (!file) {
      setFileRowCount(null);
      setParsedSensorDataByEngine({});
      setParserNotice(null);
      return;
    }

    try {
      const result = await parseTelemetry(file);
      if (result.success) {
        setFileRowCount(result.rowCount);
        setParsedSensorDataByEngine(result.enginesData);
        if (result.warnings && result.warnings.length > 0) {
          setParserNotice(result.warnings.join(' '));
        } else {
          setParserNotice(null);
        }
      } else {
        setFileRowCount(null);
        setParsedSensorDataByEngine({});
        setParserNotice(
          `Local sensor visualization preview note: ${result.error}. (The FastAPI backend will perform authoritative validation upon prediction).`
        );
      }
    } catch (err) {
      setFileRowCount(null);
      setParsedSensorDataByEngine({});
      setParserNotice(`Unable to parse sensor observation curves: ${err.message}`);
    }
  };

  // Handle Dataset Switch (state invalidation to prevent stale display)
  const handleDatasetChange = (datasetId) => {
    if (selectedDataset !== datasetId) {
      setSelectedDataset(datasetId);
      setPredictionResponse(null);
      setSelectedEngineId(null);
      setUploadError(null);
    }
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
      const response = await predictFromCsv(
        selectedFile,
        true,
        (progress) => {
          setUploadProgress(progress);
        },
        selectedDataset
      );

      setPredictionResponse(response);

      if (response.fleet_schedule) {
        setFleetSchedule(response.fleet_schedule);
      }

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
        err.message || 'Prediction failed. Check that all required sensor channels exist in the CSV.'
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Fleet Scheduling Capacity Updater
  const handleUpdateScheduleCapacity = useCallback(
    async (hangarCapacity, leadTimeCycles) => {
      setIsScheduleLoading(true);
      try {
        const engines =
          predictionResponse?.predictions?.map((p) => ({
            engine_id: p.engine_id,
            predicted_rul: p.predicted_rul,
            current_cycle: p.current_cycle,
            priority: p.priority || p.maintenance_recommendation?.priority || 'P3_ROUTINE',
            risk_level: p.risk_level,
          })) || null;

        const scheduleData = await getFleetSchedule({
          hangarCapacity,
          leadTimeCycles,
          engines,
        });
        setFleetSchedule(scheduleData);
      } catch (err) {
        console.warn('Failed to update fleet schedule:', err);
      } finally {
        setIsScheduleLoading(false);
      }
    },
    [predictionResponse]
  );

  // Load schedule if entering maintenance tab with empty schedule
  useEffect(() => {
    if (activeTab === 'maintenance' && !fleetSchedule) {
      handleUpdateScheduleCapacity(2, 5);
    }
  }, [activeTab, fleetSchedule, handleUpdateScheduleCapacity]);

  // Selected engine prediction object
  const currentEnginePrediction =
    predictionResponse?.predictions?.find(
      (p) => p.engine_id === selectedEngineId
    ) || predictionResponse?.predictions?.[0];

  const currentEngineSensorData =
    selectedEngineId && parsedSensorDataByEngine[selectedEngineId]
      ? parsedSensorDataByEngine[selectedEngineId]
      : parsedSensorDataByEngine[Object.keys(parsedSensorDataByEngine)[0]] || [];

  // Count distinct engines in loaded page 1 history records
  const distinctEnginesInLoadedHistory = new Set(
    historyRecords.map((r) => r.engine_id)
  ).size;

  return (
    <div className="app-shell">
      {/* Collapsible Aviation Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasActivePrediction={!!predictionResponse}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        health={health}
      />

      {/* Main Shell Container */}
      <div className="app-container">
        {/* Aerospace Top Command Header */}
        <Header
          health={health}
          isCheckingHealth={isCheckingHealth}
          onRefreshHealth={checkHealthStatus}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        />

        {/* Secondary Navigation Bar (ensures complete unit test compatibility) */}
        <Navbar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hasActivePrediction={!!predictionResponse}
        />

        {/* Main Content Viewport */}
        <main className="main-content">
          {/* TAB 1: FLEET OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
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
                  Operational dashboard for NASA C-MAPSS (FD001–FD004) engine degradation analysis with Physics-Informed Neural Networks.
                </p>
              </div>

              {/* Visual Fleet Analytics Dashboard */}
              <FleetAnalyticsOverview
                predictionResponse={predictionResponse}
                historyRecords={historyRecords}
                historyTotal={historyTotal}
                onNavigateToUpload={() => setActiveTab('predict')}
              />

              {/* Live Backend & ML State Card */}
              <SystemHealthCard health={health} />

              {/* Section 1: Active Inference Fleet Summary */}
              <div style={{ margin: '8px 0' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                  }}
                >
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
                    Active Batch Fleet Summary
                  </h3>
                  {predictionResponse ? (
                    <span
                      className="badge badge-healthy"
                      style={{ textTransform: 'none', fontWeight: 500 }}
                    >
                      Latest Run: {predictionResponse.fleet_summary.total_engines} engine(s) evaluated
                    </span>
                  ) : (
                    <span
                      className="badge badge-neutral"
                      style={{ textTransform: 'none', fontWeight: 500 }}
                    >
                      Awaiting Ingestion
                    </span>
                  )}
                </div>

                <FleetSummaryCards
                  summary={predictionResponse ? predictionResponse.fleet_summary : null}
                  onNavigateToUpload={() => setActiveTab('predict')}
                />
              </div>

              {/* Section 2: Database Activity Summary */}
              <div style={{ margin: '8px 0' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                  }}
                >
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
                    Database Historical Records Activity
                  </h3>
                  <span
                    className="badge badge-neutral"
                    style={{ textTransform: 'none', fontWeight: 500 }}
                  >
                    Persistent Supabase Log
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '16px',
                  }}
                >
                  <div className="stat-card">
                    <div className="stat-label">
                      <span>TOTAL LOGGED PREDICTIONS</span>
                    </div>
                    <div className="stat-value">
                      {historyTotal.toLocaleString()}
                    </div>
                    <div className="stat-meta">
                      Total records stored in database
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-label">
                      <span>LOADED RECORDS (PAGE {historyPage})</span>
                    </div>
                    <div className="stat-value">
                      {historyRecords.length}
                    </div>
                    <div className="stat-meta">
                      {distinctEnginesInLoadedHistory} distinct engine unit(s) on page
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-label">
                      <span>DATABASE MODE</span>
                    </div>
                    <div
                      className="stat-value"
                      style={{
                        fontSize: '20px',
                        color:
                          health?.database_connected && health?.database_type === 'supabase'
                            ? 'var(--healthy-main)'
                            : 'var(--text-main)',
                      }}
                    >
                      {health?.database_type === 'supabase' ? 'Supabase Cloud' : 'In-Memory Fallback'}
                    </div>
                    <div className="stat-meta">
                      {health?.database_connected ? 'Connected with UUID keys' : 'Resilient local mode'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Action Navigation Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '16px',
                  margin: '8px 0',
                }}
              >
                <div
                  onClick={() => setActiveTab('predict')}
                  className="card"
                  style={{
                    padding: '18px 20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--primary-50)',
                        color: 'var(--accent-cyan)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                      }}
                    >
                      <UploadCloud size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        Predict Remaining Useful Life
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Upload telemetry CSV to run real-time PINN inference
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={18} style={{ color: 'var(--accent-cyan)' }} />
                </div>

                <div
                  onClick={() => setActiveTab('analytics')}
                  className="card"
                  style={{
                    padding: '18px 20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'rgba(56, 189, 248, 0.1)',
                        color: 'var(--moderate-main)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--moderate-border)',
                      }}
                    >
                      <Layers size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        Explore Benchmark Analytics
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Review RMSE, MAE, R², and NASA scores for FD001–FD004
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={18} style={{ color: 'var(--accent-cyan)' }} />
                </div>
              </div>

              {/* Prognostics Reference Guide */}
              <QuickGuideCard />
            </div>
          )}

          {/* TAB 2: TELEMETRY & PREDICTION */}
          {activeTab === 'predict' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
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
                  Upload flight sensor observations to execute real-time Physics-Informed Neural Network (PINN) inference.
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

              {parserNotice && (
                <Alert
                  type="warning"
                  title="Telemetry Parser Note"
                  onClose={() => setParserNotice(null)}
                >
                  {parserNotice}
                </Alert>
              )}

              <Card
                title="Select or Upload Engine Sensor Data"
                subtitle="Supports NASA C-MAPSS 26-column space-separated format or standard CSV with headers"
                icon={UploadCloud}
              >
                {/* Dataset Selection Bar */}
                <div
                  style={{
                    marginBottom: '20px',
                    padding: '14px 18px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                      Target C-MAPSS Fleet Sub-dataset
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Selects calibrated PINN weights, flight regime clustering, and feature scalers
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {[
                      { id: 'FD001', label: 'FD001', desc: '1 Cond (SL), 1 Fault (HPC), 14 feats' },
                      { id: 'FD002', label: 'FD002', desc: '6 Regimes, 1 Fault (HPC), 18 feats' },
                      { id: 'FD003', label: 'FD003', desc: '1 Cond (SL), 2 Faults (HPC+Fan), 15 feats' },
                      { id: 'FD004', label: 'FD004', desc: '6 Regimes, 2 Faults (HPC+Fan), 19 feats' },
                    ].map((ds) => (
                      <button
                        key={ds.id}
                        type="button"
                        onClick={() => handleDatasetChange(ds.id)}
                        title={ds.desc}
                        className={`btn btn-sm ${
                          selectedDataset === ds.id ? 'btn-primary' : 'btn-secondary'
                        }`}
                        style={{ padding: '6px 14px' }}
                      >
                        {ds.label}
                      </button>
                    ))}
                  </div>
                </div>

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
                      setParsedSensorDataByEngine({});
                      setParserNotice(null);
                    }}
                    onReplace={() => {
                      setSelectedFile(null);
                      setFileRowCount(null);
                      setParsedSensorDataByEngine({});
                      setParserNotice(null);
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
                    Payload target: <code>POST /predict?dataset={selectedDataset}</code> &bull; Real ML Pipeline
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
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
                    Evaluated with {predictionResponse?.model_type || 'PINN'} ({predictionResponse?.model_version || health?.model_version || 'pinn-v1.0'}) for dataset {predictionResponse?.dataset || selectedDataset}.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('predict')}
                  className="btn btn-secondary btn-sm"
                >
                  <RotateCcw size={13} />
                  <span>Upload Another File</span>
                </button>
              </div>

              {!predictionResponse ? (
                <div className="card" style={{ padding: '56px 24px', textAlign: 'center' }}>
                  <Activity size={40} style={{ color: 'var(--text-secondary)', margin: '0 auto 12px auto' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>
                    No Prediction Active in Current Session
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0 20px 0' }}>
                    Upload a sensor telemetry CSV file or select a C-MAPSS sample to view remaining useful life estimations.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('predict')}
                    className="btn btn-primary"
                  >
                    <UploadCloud size={16} />
                    <span>Go to Upload Page</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Multi-Engine Selector (if fleet CSV) */}
                  <EngineSelector
                    predictions={predictionResponse.predictions}
                    selectedEngineId={selectedEngineId}
                    onSelectEngine={setSelectedEngineId}
                  />

                  {/* Single Engine RUL Card */}
                  <EngineRulCard prediction={currentEnginePrediction} />

                  {/* Degradation Trajectory Curve */}
                  <TrajectoryChart
                    trajectory={currentEnginePrediction?.trajectory}
                    engineId={currentEnginePrediction?.engine_id}
                  />

                  {/* Physical Sensor Telemetry Trends */}
                  <SensorTelemetryChart
                    sensorData={currentEngineSensorData}
                    engineId={currentEnginePrediction?.engine_id}
                  />

                  {/* Explainability & Feature Attribution */}
                  <ExplanationPanel
                    explanation={currentEnginePrediction?.explanation}
                    engineId={currentEnginePrediction?.engine_id}
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ANALYTICS & MODEL PERFORMANCE */}
          {activeTab === 'analytics' && <AnalyticsView />}

          {/* TAB 5: MAINTENANCE & SCHEDULING */}
          {activeTab === 'maintenance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2
                  style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Fleet Maintenance Scheduling & Work Orders
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Deterministic priority optimization under bay capacity limits, technician work orders, and audit trail.
                </p>
              </div>

              {/* Fleet Maintenance Scheduling Card */}
              <FleetSchedulerCard
                scheduleData={fleetSchedule}
                onUpdateCapacity={handleUpdateScheduleCapacity}
                onCreateWorkOrder={(item) => {
                  setWorkOrderPreFill({
                    engine_id: item.engine_id,
                    priority: item.priority,
                    predicted_rul: item.predicted_rul,
                    scheduled_cycle_target: item.scheduled_cycle_target,
                    recommendation: `Priority ${item.priority} overhaul for Unit #${item.engine_id}. RUL: ${item.predicted_rul.toFixed(1)} cycles.`,
                  });
                }}
                isLoading={isScheduleLoading}
              />

              {/* Maintenance Work Orders CRUD View */}
              <MaintenanceRecordsView
                initialWorkOrderData={workOrderPreFill}
                onClearInitial={() => setWorkOrderPreFill(null)}
              />
            </div>
          )}

          {/* TAB 6: EXPLAINABILITY */}
          {activeTab === 'explainability' && (
            <ExplainabilityView
              predictionResponse={predictionResponse}
              selectedEngineId={selectedEngineId}
              onSelectEngine={setSelectedEngineId}
              onNavigateToUpload={() => setActiveTab('predict')}
            />
          )}

          {/* TAB 7: PREDICTION HISTORY */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
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

          {/* TAB 8: PROJECT INFO */}
          {activeTab === 'project_info' && <ProjectInfoView />}
        </main>

        {/* Global Footer */}
        <Footer />
      </div>
    </div>
  );
}
