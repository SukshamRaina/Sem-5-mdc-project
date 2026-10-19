import React, { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
  Plus,
  FileText,
  UserCheck,
  RefreshCw,
  Search,
} from 'lucide-react';
import Card from '../common/Card';
import { getMaintenanceRecords, createMaintenanceRecord, updateMaintenanceRecord } from '../../services/api';

export default function MaintenanceRecordsView({ initialWorkOrderData = null, onClearInitial = null }) {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [engineFilter, setEngineFilter] = useState('');

  // New Work Order Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formEngineId, setFormEngineId] = useState('');
  const [formAction, setFormAction] = useState('');
  const [formTechnician, setFormTechnician] = useState('');
  const [formScheduledCycle, setFormScheduledCycle] = useState('');
  const [formStatus, setFormStatus] = useState('PENDING');
  const [formNotes, setFormNotes] = useState('');
  const [formSuccessMessage, setFormSuccessMessage] = useState(null);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMaintenanceRecords({
        engineId: engineFilter ? Number(engineFilter) : null,
        status: statusFilter !== 'ALL' ? statusFilter : null,
      });
      setRecords(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch maintenance records.');
    } finally {
      setIsLoading(false);
    }
  }, [engineFilter, statusFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Handle pre-filled creation trigger from other tabs (e.g. FleetSchedulerCard)
  useEffect(() => {
    if (initialWorkOrderData) {
      setFormEngineId(String(initialWorkOrderData.engine_id || ''));
      setFormAction(
        initialWorkOrderData.recommendation ||
        `Scheduled maintenance inspection for Engine #${initialWorkOrderData.engine_id} (${initialWorkOrderData.priority || 'P1'})`
      );
      setFormScheduledCycle(String(initialWorkOrderData.scheduled_cycle_target || ''));
      setFormStatus('PENDING');
      setFormNotes(`Auto-generated from Fleet Prioritization. Predicted RUL: ${initialWorkOrderData.predicted_rul || 'N/A'} cycles.`);
      setShowCreateModal(true);
      if (onClearInitial) onClearInitial();
    }
  }, [initialWorkOrderData, onClearInitial]);

  const handleCreateRecord = async (e) => {
    e.preventDefault();
    if (!formEngineId || !formAction) {
      setError('Engine ID and Maintenance Action description are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await createMaintenanceRecord({
        engine_id: Number(formEngineId),
        action_taken: formAction,
        technician_id: formTechnician.trim() || 'A&P-REVIEWER',
        scheduled_cycle: formScheduledCycle ? Number(formScheduledCycle) : null,
        status: formStatus,
        notes: formNotes.trim() || null,
      });

      setFormSuccessMessage(`Work order created for Engine #${formEngineId}`);
      setShowCreateModal(false);
      // Reset form
      setFormEngineId('');
      setFormAction('');
      setFormTechnician('');
      setFormScheduledCycle('');
      setFormNotes('');
      fetchRecords();

      setTimeout(() => setFormSuccessMessage(null), 4000);
    } catch (err) {
      setError(err.message || 'Failed to create work order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (recordId, newStatus) => {
    try {
      await updateMaintenanceRecord(recordId, { status: newStatus });
      fetchRecords();
    } catch (err) {
      setError(`Failed to update status: ${err.message}`);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="badge badge-healthy">COMPLETED</span>;
      case 'IN_PROGRESS':
        return <span className="badge badge-moderate">IN PROGRESS</span>;
      case 'CANCELLED':
        return <span className="badge badge-disabled">CANCELLED</span>;
      case 'PENDING':
      default:
        return <span className="badge badge-warning">PENDING</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Controls Card */}
      <Card
        title="Maintenance Work Orders & Service Records"
        subtitle="Operational depot work orders, technician sign-offs, and scheduled bay actions"
        icon={Wrench}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '16px',
          }}
        >
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((st) => (
              <button
                key={st}
                type="button"
                className={`btn ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '11px', padding: '4px 10px', height: '28px' }}
                onClick={() => setStatusFilter(st)}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Engine Search & Create Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                placeholder="Filter Engine #"
                value={engineFilter}
                onChange={(e) => setEngineFilter(e.target.value)}
                style={{
                  width: '130px',
                  padding: '5px 8px 5px 28px',
                  fontSize: '12px',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                }}
              />
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                }}
              />
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px', height: '28px' }}
              onClick={fetchRecords}
              disabled={isLoading}
              title="Refresh maintenance records"
            >
              <RefreshCw size={13} className={isLoading ? 'spin-animation' : ''} />
            </button>

            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: '12px', padding: '6px 14px' }}
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={14} style={{ marginRight: '4px' }} />
              Log Work Order
            </button>
          </div>
        </div>

        {formSuccessMessage && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--healthy-bg)',
              border: '1px solid var(--healthy-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--healthy-text)',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '16px',
            }}
          >
            {formSuccessMessage}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--critical-bg)',
              border: '1px solid var(--critical-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--critical-text)',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        {/* Records Table */}
        {isLoading && records.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading maintenance records from storage...
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <FileText size={28} className="empty-state-icon" />
            <p>No maintenance records found matching current criteria.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Engine</th>
                  <th>Action / Description</th>
                  <th>Technician</th>
                  <th>Target Cycle</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th>Update Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {rec.id ? rec.id.slice(0, 8) : 'N/A'}
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '13px' }}>
                        Unit #{rec.engine_id}
                      </span>
                    </td>
                    <td style={{ maxWidth: '300px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600 }}>
                        {rec.action_taken}
                      </div>
                      {rec.notes && (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Notes: {rec.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-body)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <UserCheck size={12} style={{ color: 'var(--primary-600)' }} />
                        <span>{rec.technician_id || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600 }}>
                      {rec.scheduled_cycle ? `Cycle ${rec.scheduled_cycle}` : 'Immediate'}
                    </td>
                    <td>{getStatusBadge(rec.status)}</td>
                    <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {rec.created_at ? new Date(rec.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td>
                      <select
                        value={rec.status}
                        onChange={(e) => handleStatusChange(rec.id, e.target.value)}
                        style={{
                          fontSize: '11px',
                          padding: '3px 6px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-medium)',
                          backgroundColor: 'var(--bg-canvas)',
                        }}
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Work Order Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '540px',
              backgroundColor: 'var(--bg-card)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wrench size={18} style={{ color: 'var(--primary-600)' }} />
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                  Create Maintenance Work Order
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="btn btn-secondary"
                style={{ padding: '2px 8px', fontSize: '12px' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateRecord} style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Engine Unit ID *
                  </label>
                  <input
                    type="number"
                    required
                    value={formEngineId}
                    onChange={(e) => setFormEngineId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '13px',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Target Cycle Deadline
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 175"
                    value={formScheduledCycle}
                    onChange={(e) => setFormScheduledCycle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '13px',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Maintenance Action / Description *
                </label>
                <textarea
                  required
                  rows={2}
                  value={formAction}
                  onChange={(e) => setFormAction(e.target.value)}
                  placeholder="e.g. Borescope inspection of HPC stages 4-7 and fan blade seal replacement."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '13px',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Technician Badge / ID
                  </label>
                  <input
                    type="text"
                    placeholder="TECH-482"
                    value={formTechnician}
                    onChange={(e) => setFormTechnician(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '13px',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Initial Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '13px',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-canvas)',
                    }}
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="IN_PROGRESS">IN PROGRESS</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Engineering Notes & Human Review Sign-Off
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Additional observations, part numbers, or A&P engineer verification comments."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '13px',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Logging...' : 'Save Work Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
