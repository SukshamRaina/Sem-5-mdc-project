import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function HistoryPagination({
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  disabled,
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
        borderTop: '1px solid var(--border-light)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Rows per page:
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          disabled={disabled}
          className="form-select"
          style={{ padding: '3px 6px', fontSize: '12px' }}
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Page <strong>{currentPage}</strong> of <strong>{Math.max(1, totalPages)}</strong>
        </span>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={disabled || currentPage <= 1}
            className="btn btn-secondary btn-sm"
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
            <span>Prev</span>
          </button>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={disabled || currentPage >= totalPages}
            className="btn btn-secondary btn-sm"
            aria-label="Next page"
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
