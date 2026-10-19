import React, { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';

export default function FileUploadZone({
  onFileSelected,
  isUploading,
  uploadProgress,
  disabled,
}) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (disabled || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onFileSelected(file);
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onFileSelected(file);
    }
  };

  return (
    <div
      className={`drop-zone ${isDragActive ? 'drag-active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => {
        if (!disabled && !isUploading && inputRef.current) {
          inputRef.current.click();
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && inputRef.current) {
          inputRef.current.click();
        }
      }}
      aria-label="Upload CSV File Zone"
      style={{
        opacity: disabled ? 0.6 : 1,
        cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt"
        style={{ display: 'none' }}
        onChange={handleInputChange}
        disabled={disabled || isUploading}
      />

      <div className="drop-zone-icon">
        <UploadCloud size={24} />
      </div>

      <div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
          {isUploading ? 'Uploading & Processing Telemetry...' : 'Drag & drop telemetry CSV file here, or browse'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Supports NASA C-MAPSS 26-column format or CSV with headers (Max 10 MB)
        </div>
      </div>

      {isUploading && (
        <div style={{ width: '100%', maxWidth: '320px', marginTop: '12px' }}>
          <div
            style={{
              height: '6px',
              backgroundColor: 'var(--border-light)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${uploadProgress || 20}%`,
                backgroundColor: 'var(--primary-600)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              marginTop: '4px',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Executing LSTM inference pipeline...</span>
            <span>{uploadProgress > 0 ? `${uploadProgress}%` : 'Inferring...'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
