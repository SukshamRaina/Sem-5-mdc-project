import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  LineChart,
  History,
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
      id: 'history',
      label: 'Prediction History',
      icon: History,
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
              onClick={() => onTabChange(tab.id)}
              className={`nav-tab ${isActive ? 'active' : ''}`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  style={{
                    backgroundColor: 'var(--primary-100)',
                    color: 'var(--primary-700)',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-full)',
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
