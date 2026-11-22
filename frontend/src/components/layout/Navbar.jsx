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
} from 'lucide-react';

export default function Navbar({
  activeTab,
  onTabChange,
  hasActivePrediction,
}) {
  const tabs = [
    {
      id: 'overview',
      label: 'Fleet Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'predict',
      label: 'Telemetry & Prediction',
      icon: UploadCloud,
    },
    {
      id: 'results',
      label: 'Results & Sensor Analytics',
      icon: LineChart,
      badge: hasActivePrediction ? 'Active' : null,
    },
    {
      id: 'analytics',
      label: 'Model Benchmarks',
      icon: BarChart3,
    },
    {
      id: 'maintenance',
      label: 'Maintenance & Scheduling',
      icon: Wrench,
    },
    {
      id: 'explainability',
      label: 'Feature Attribution',
      icon: Brain,
    },
    {
      id: 'history',
      label: 'Prediction History',
      icon: History,
    },
    {
      id: 'project_info',
      label: 'Project Info',
      icon: Info,
    },
  ];

  return (
    <nav className="nav-bar">
      <div className="nav-inner">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`nav-tab ${isActive ? 'active' : ''}`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  style={{
                    backgroundColor: 'rgba(14, 165, 233, 0.25)',
                    color: 'var(--accent-cyan)',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
