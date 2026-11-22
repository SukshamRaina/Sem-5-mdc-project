import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  LineChart,
  BarChart3,
  Wrench,
  Brain,
  History,
  Info,
  ChevronLeft,
  ChevronRight,
  Plane,
  Activity,
  Cpu,
  Database,
  X,
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  onTabChange,
  hasActivePrediction,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  health,
}) {
  const navItems = [
    {
      id: 'overview',
      label: 'Fleet Command Deck',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'predict',
      label: 'Telemetry Ingestion',
      icon: UploadCloud,
      badge: null,
    },
    {
      id: 'results',
      label: 'Degradation Analysis',
      icon: LineChart,
      badge: hasActivePrediction ? 'Active' : null,
    },
    {
      id: 'analytics',
      label: 'Model Benchmarks',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'maintenance',
      label: 'Maintenance & Hangar',
      icon: Wrench,
      badge: null,
    },
    {
      id: 'explainability',
      label: 'Feature Attribution',
      icon: Brain,
      badge: null,
    },
    {
      id: 'history',
      label: 'Historical Logs & DB',
      icon: History,
      badge: null,
    },
    {
      id: 'project_info',
      label: 'Project Specifications',
      icon: Info,
      badge: null,
    },
  ];

  const handleSelectTab = (tabId) => {
    onTabChange(tabId);
    if (isMobileOpen && onCloseMobile) {
      onCloseMobile();
    }
  };

  const isHealthy = health?.status === 'healthy';

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={onCloseMobile}
          aria-label="Close navigation sidebar"
        />
      )}

      <aside
        className={`app-sidebar ${isCollapsed ? 'collapsed' : ''} ${
          isMobileOpen ? 'mobile-open' : ''
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 10px rgba(14, 165, 233, 0.4)',
              }}
            >
              <Plane size={18} />
            </div>
            {!isCollapsed && (
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    color: 'var(--text-main)',
                    letterSpacing: '0.04em',
                    lineHeight: 1.2,
                  }}
                >
                  AERO<span style={{ color: 'var(--accent-cyan)' }}>PROGNOSTICS</span>
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.02em',
                  }}
                >
                  NASA C-MAPSS PINN
                </div>
              </div>
            )}
          </div>

          {/* Close button for mobile or collapse toggle for desktop */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {isMobileOpen ? (
              <button
                type="button"
                onClick={onCloseMobile}
                className="btn btn-secondary btn-sm"
                style={{ padding: '4px', border: 'none' }}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="btn btn-secondary btn-sm"
                style={{
                  padding: '4px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                }}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
            )}
          </div>
        </div>

        {/* Navigation Item List */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <span className="sidebar-item-icon">
                  <Icon size={18} />
                </span>
                {!isCollapsed && (
                  <span className="sidebar-item-label">{item.label}</span>
                )}
                {!isCollapsed && item.badge && (
                  <span className="sidebar-item-badge">{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer telemetry & system status */}
        {!isCollapsed && (
          <div className="sidebar-footer">
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              System Telemetry
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Activity size={12} /> Status:
                </span>
                <span style={{ color: isHealthy ? 'var(--healthy-main)' : 'var(--critical-main)', fontWeight: 600 }}>
                  {isHealthy ? 'Nominal' : 'Offline'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Cpu size={12} /> Core:
                </span>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                  PINN Dual-Head
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Database size={12} /> Store:
                </span>
                <span style={{ color: 'var(--text-body)', fontWeight: 500 }}>
                  {health?.database_type === 'supabase' ? 'Supabase' : 'In-Memory'}
                </span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
