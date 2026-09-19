import { FileImage, X, CheckCircle2, AlertCircle } from 'lucide-react';
import type { InputFile, AnalysisPhase } from '../../types/analysis';
import { formatBytes } from '../../lib/formatters';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

interface FileCardProps {
  inputFile: InputFile;
  phase: AnalysisPhase;
  onClear: () => void;
}

const FORMAT_LABEL: Record<InputFile['detectedFormat'], string> = {
  PNG:         'PNG',
  JPEG:        'JPEG',
  TIFF:        'TIFF',
  UNSUPPORTED: 'Unknown',
};

export function FileCard({ inputFile, phase, onClear }: FileCardProps) {
  const isValidating = phase === 'FILE_SELECTED' || phase === 'VALIDATING';
  const isValid = phase === 'READY';
  const isError = phase === 'VALIDATION_ERROR';

  return (
    <div
      className={[
        'rounded-lg border p-4 flex items-start gap-4 transition-colors',
        isValid
          ? 'border-emerald-800/60 bg-emerald-950/20'
          : isError
          ? 'border-red-800/60 bg-red-950/20'
          : 'bg-slate-900/60',
      ].join(' ')}
      style={
        !isValid && !isError
          ? { borderColor: 'var(--color-dw-border)' }
          : undefined
      }
    >
      {/* File icon */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border"
        style={{
          borderColor: 'var(--color-dw-border)',
          backgroundColor: 'var(--color-dw-surface-2)',
        }}
        aria-hidden="true"
      >
        <FileImage size={18} className="text-slate-400" strokeWidth={1.5} />
      </div>

      {/* File details */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-medium truncate text-slate-100"
          title={inputFile.name}
        >
          {inputFile.name}
        </p>
        <div className="mt-1 flex items-center gap-3 flex-wrap">
          {/* Size */}
          <span className="text-[11px] font-mono text-slate-500">
            {formatBytes(inputFile.sizeBytes)}
          </span>

          {/* Detected format badge */}
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
            style={{
              color: 'var(--color-dw-text-sub)',
              borderColor: 'var(--color-dw-border)',
              backgroundColor: 'var(--color-dw-surface-2)',
            }}
          >
            {FORMAT_LABEL[inputFile.detectedFormat]}
          </span>

          {/* MIME type */}
          {inputFile.mimeType && (
            <span className="text-[11px] text-slate-600">
              {inputFile.mimeType || '—'}
            </span>
          )}
        </div>

        {/* Validation status line */}
        <div className="mt-2 flex items-center gap-2">
          {isValidating && (
            <>
              <Spinner size="sm" label="Validating file…" />
              <span className="text-[11px] text-slate-500">Validating…</span>
            </>
          )}
          {isValid && (
            <>
              <CheckCircle2
                size={13}
                className="text-emerald-400 shrink-0"
                aria-hidden="true"
              />
              <span className="text-[11px] text-emerald-400">
                Format accepted
              </span>
            </>
          )}
          {isError && (
            <>
              <AlertCircle
                size={13}
                className="text-red-400 shrink-0"
                aria-hidden="true"
              />
              <span className="text-[11px] text-red-400">
                Validation failed
              </span>
            </>
          )}
        </div>
      </div>

      {/* Clear button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        aria-label={`Remove file ${inputFile.name}`}
        className="shrink-0 -mt-1 -mr-1 p-1.5"
      >
        <X size={14} aria-hidden="true" />
      </Button>
    </div>
  );
}
