import { AlertCircle, AlertTriangle } from 'lucide-react';
import type { ValidationResult } from '../../types/analysis';

interface ValidationPanelProps {
  result: ValidationResult;
}

export function ValidationPanel({ result }: ValidationPanelProps) {
  if (result.errors.length === 0 && result.warnings.length === 0) return null;

  return (
    <div
      className="rounded-lg border overflow-hidden"
      role="alert"
      aria-live="polite"
    >
      {/* Errors */}
      {result.errors.map((err) => (
        <div
          key={err.code}
          className="flex gap-3 items-start px-4 py-3 border-b border-red-900/40 bg-red-950/25"
        >
          <AlertCircle
            size={14}
            className="text-red-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <p className="text-[11px] font-mono text-red-300 mb-0.5 uppercase tracking-wide">
              {err.code.replace(/_/g, ' ')}
            </p>
            <p className="text-[12px] text-red-200">{err.message}</p>
          </div>
        </div>
      ))}

      {/* Warnings */}
      {result.warnings.map((warn) => (
        <div
          key={warn.code}
          className="flex gap-3 items-start px-4 py-3 bg-amber-950/20"
          style={{ borderColor: 'rgba(245,158,11,0.25)', borderTopWidth: result.errors.length > 0 ? '1px' : '0' }}
        >
          <AlertTriangle
            size={14}
            className="text-amber-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <p className="text-[11px] font-mono text-amber-300 mb-0.5 uppercase tracking-wide">
              {warn.code.replace(/_/g, ' ')}
            </p>
            <p className="text-[12px] text-amber-200">{warn.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
