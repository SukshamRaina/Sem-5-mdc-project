import React, { useState } from 'react';
import { ExternalLink, Inbox } from 'lucide-react';
import Badge from '../common/Badge';
import LoadingSpinner from '../common/LoadingSpinner';
import RecordDetailModal from './RecordDetailModal';

export default function HistoryTable({ records = [], isLoading, error }) {
  const [selectedRecord, setSelectedRecord] = useState(null);

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Retrieving prediction logs from database..." />;
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        Failed to load prediction history: {error}
      </div>
    );
  }

  if (!records || records.length === 0) {
    return (
      <div className="empty-state">
        <Inbox size={32} className="empty-state-icon" />
        <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
          No prediction history found
        </p>
        <p style={{ fontSize: '12px' }}>
          Execute an inference via the Telemetry tab to log predictions to the database.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Record ID</th>
              <th>Engine Unit</th>
              <th>Latest Cycle</th>
              <th>Cycles Analyzed</th>
              <th>Estimated RUL</th>
              <th>Risk Tier</th>
              <th>Maintenance Recommendation</th>
              <th>Logged At</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((rec) => (
              <tr key={rec.id}>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {rec.id ? `${rec.id.slice(0, 8)}...` : 'N/A'}
                </td>
                <td style={{ fontWeight: 600 }}>Engine #{rec.engine_id}</td>
                <td>Cycle {rec.current_cycle}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{rec.cycles_analyzed}</td>
                <td>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>
                    {rec.predicted_rul}
                  </span>{' '}
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>cycles</span>
                </td>
                <td>
                  <Badge level={rec.risk_level} />
                </td>
                <td
                  style={{
                    maxWidth: '240px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: '12px',
                    color: 'var(--text-body)',
                  }}
                  title={rec.recommendation}
                >
                  {rec.recommendation || 'Operating within nominal limits.'}
                </td>
                <td style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {formatDate(rec.created_at)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    onClick={() => setSelectedRecord(rec)}
                    className="btn btn-secondary btn-sm"
                    title="View complete record metadata"
                  >
                    <ExternalLink size={12} />
                    <span>Details</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RecordDetailModal
        record={selectedRecord}
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </>
  );
}
