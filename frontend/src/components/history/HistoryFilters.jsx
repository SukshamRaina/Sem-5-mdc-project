import React from 'react';
import { Filter, RefreshCw } from 'lucide-react';

export default function HistoryFilters({
  engineId,
  onEngineIdChange,
  riskLevel,
  onRiskLevelChange,
  totalRecords,
  isLoading,
  onRefresh,
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 16px',
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)',
        marginBottom: '16px',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={15} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
            FILTERS:
          </span>
        </div>

        {/* Engine ID Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor="filter-engine" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Engine:
          </label>
          <input
            id="filter-engine"
            type="number"
            min="1"
            placeholder="All Engines"
            value={engineId}
            onChange={(e) => onEngineIdChange(e.target.value)}
            className="form-input"
            style={{ width: '110px', padding: '4px 8px', fontSize: '12px' }}
          />
        </div>

        {/* Risk Level Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor="filter-risk" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Risk Tier:
          </label>
          <select
            id="filter-risk"
            value={riskLevel}
            onChange={(e) => onRiskLevelChange(e.target.value)}
            className="form-select"
            style={{ padding: '4px 8px', fontSize: '12px' }}
          >
            <option value="ALL">All Categories</option>
            <option value="CRITICAL">Critical (RUL &le; 25)</option>
            <option value="WARNING">Warning (26 &ndash; 50)</option>
            <option value="MODERATE">Moderate (51 &ndash; 80)</option>
            <option value="HEALTHY">Healthy (RUL &gt; 80)</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Total Logged: <strong>{totalRecords || 0}</strong> records
        </span>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="btn btn-secondary btn-sm"
          title="Refresh prediction history from database"
        >
          <RefreshCw
            size={13}
            style={{
              animation: isLoading ? 'spin 1s linear infinite' : 'none',
            }}
          />
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );
}
