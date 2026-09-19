import React, { useRef, useState, useCallback } from 'react';
import { Upload, ImageIcon } from 'lucide-react';

interface DropZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  /** Short description of accepted formats shown in the drop zone */
  acceptDescription?: string;
}

const ACCEPTED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/tiff',
  'image/tif',
];

export function DropZone({
  onFile,
  disabled = false,
  acceptDescription = 'PNG, JPEG, TIFF / GeoTIFF',
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!disabled) onFile(file);
    },
    [onFile, disabled]
  );

  // Drag events
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDraggingOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // Click to browse
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      inputRef.current?.click();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label="Drop imagery here or press Enter to browse files"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={onKeyDown}
      className={[
        'relative rounded-lg border-2 border-dashed p-10',
        'flex flex-col items-center justify-center gap-4',
        'cursor-pointer transition-colors duration-150 select-none',
        'min-h-[220px]',
        disabled
          ? 'opacity-50 cursor-not-allowed border-slate-800'
          : isDraggingOver
          ? 'border-sky-500 bg-sky-950/20'
          : 'border-slate-700 hover:border-slate-500 hover:bg-slate-900/40',
      ].join(' ')}
    >
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        id="imagery-upload"
        accept={ACCEPTED_MIME_TYPES.join(',')}
        className="sr-only"
        aria-label="Select imagery file"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          // Reset so the same file can be re-selected after clearing
          e.target.value = '';
        }}
      />

      {/* Icon */}
      <div
        className={[
          'w-14 h-14 rounded-xl flex items-center justify-center border transition-colors',
          isDraggingOver
            ? 'border-sky-600 bg-sky-900/30'
            : 'border-slate-700 bg-slate-900',
        ].join(' ')}
        aria-hidden="true"
      >
        {isDraggingOver ? (
          <Upload size={24} className="text-sky-400" strokeWidth={1.5} />
        ) : (
          <ImageIcon size={24} className="text-slate-500" strokeWidth={1.5} />
        )}
      </div>

      {/* Text */}
      <div className="text-center">
        <p className="text-[13px] font-medium" style={{ color: 'var(--color-dw-text-sub)' }}>
          {isDraggingOver
            ? 'Release to load imagery'
            : 'Drop imagery here, or click to browse'}
        </p>
        <p className="mt-1 text-[12px]" style={{ color: 'var(--color-dw-text-dim)' }}>
          Accepted: {acceptDescription}
        </p>
      </div>
    </div>
  );
}
