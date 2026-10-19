import React from 'react';
import { FileText, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function FilePreviewCard({
  file,
  rowCount,
  onRemove,
  onReplace,
  disabled,
}) {
  if (!file) return null;

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-xs)',
        margin: '16px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--primary-50)',
            color: 'var(--primary-700)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <FileText size={20} />
        </div>
        <div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{file.name}</span>
            <CheckCircle2 size={14} style={{ color: 'var(--healthy-main)' }} />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Size: {formatSize(file.size)}
            {rowCount !== null && rowCount !== undefined && ` • ${rowCount.toLocaleString()} data rows`}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={onReplace}
          disabled={disabled}
          className="btn btn-secondary btn-sm"
          title="Select a different file"
        >
          <RefreshCw size={13} />
          <span>Change</span>
        </button>
        <button
          onClick={onRemove}
          disabled={disabled}
          className="btn btn-secondary btn-sm"
          style={{ color: 'var(--critical-main)' }}
          title="Remove selected file"
        >
          <Trash2 size={13} />
          <span>Remove</span>
        </button>
      </div>
    </div>
  );
}
