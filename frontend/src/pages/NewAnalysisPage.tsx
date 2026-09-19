import { ArrowLeft, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PipelineSteps } from '../components/workspace/PipelineSteps';
import { DropZone } from '../components/upload/DropZone';
import { FileCard } from '../components/upload/FileCard';
import { MetadataPanel } from '../components/upload/MetadataPanel';
import { ValidationPanel } from '../components/upload/ValidationPanel';
import { Button } from '../components/ui/Button';
import { useAnalysis } from '../hooks/useAnalysis';

export function NewAnalysisPage() {
  const navigate = useNavigate();
  const { phase, inputFile, metadata, validationResult, setFile, clearFile } =
    useAnalysis();

  const isReady = phase === 'READY';
  const isValidating = phase === 'VALIDATING' || phase === 'FILE_SELECTED';
  const isDisabled = phase === 'SUBMITTING';

  return (
    <div
      className="flex-1 flex flex-col"
      style={{ backgroundColor: 'var(--color-dw-bg)' }}
    >
      {/* ── Workspace header ── */}
      <div
        className="border-b px-6 py-3 flex items-center gap-4"
        style={{
          borderColor: 'var(--color-dw-border)',
          backgroundColor: 'var(--color-dw-surface)',
        }}
      >
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-[12px] transition-colors hover:text-slate-200 cursor-pointer"
          style={{ color: 'var(--color-dw-text-dim)' }}
          aria-label="Back to workspace"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          Back
        </button>

        <div
          className="w-px h-4 shrink-0"
          style={{ backgroundColor: 'var(--color-dw-border)' }}
          aria-hidden="true"
        />

        {/* Pipeline step indicator */}
        <PipelineSteps activeStage="input" />
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-auto px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Section label */}
          <div>
            <p
              className="text-[10px] font-mono uppercase tracking-widest mb-1"
              style={{ color: 'var(--color-dw-text-dim)' }}
            >
              Stage 01
            </p>
            <h1 className="text-lg font-semibold text-slate-100">Input Image</h1>
            <p
              className="text-[12px] mt-1"
              style={{ color: 'var(--color-dw-text-sub)' }}
            >
              Upload a single optical remote-sensing image. Supported formats:
              PNG, JPEG, TIFF (GeoTIFF georeferencing detected by backend).
            </p>
          </div>

          {/* ── Drop zone (shown when no file) ── */}
          {!inputFile && (
            <DropZone
              onFile={setFile}
              disabled={isDisabled}
              acceptDescription="PNG, JPEG, TIFF / GeoTIFF"
            />
          )}

          {/* ── File card + validation (shown when file selected) ── */}
          {inputFile && (
            <FileCard
              inputFile={inputFile}
              phase={phase}
              onClear={clearFile}
            />
          )}

          {/* Validation errors / warnings */}
          {validationResult && (
            <ValidationPanel result={validationResult} />
          )}

          {/* ── Metadata panel (always shown after file selected) ── */}
          {inputFile && (
            <MetadataPanel metadata={metadata} />
          )}

          {/* ── Ready-for-processing panel ── */}
          {isReady && (
            <div
              className="rounded-lg border px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              style={{
                borderColor: 'rgba(14,165,233,0.3)',
                backgroundColor: 'rgba(14,165,233,0.06)',
              }}
              role="status"
              aria-live="polite"
            >
              <div>
                <p className="text-[13px] font-medium text-sky-300">
                  Ready for processing
                </p>
                <p
                  className="text-[11px] mt-0.5"
                  style={{ color: 'var(--color-dw-text-dim)' }}
                >
                  Demo mode — backend connection pending. Processing will be
                  available once the inference service is deployed.
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                disabled
                title="Backend not connected — processing unavailable in demo mode"
                className="shrink-0 opacity-60"
                aria-disabled="true"
              >
                <Send size={14} aria-hidden="true" />
                Submit for Processing
              </Button>
            </div>
          )}

          {/* Replace file option (shown after validation) */}
          {inputFile && !isValidating && phase !== 'IDLE' && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFile}
                id="replace-file-btn"
              >
                ← Select a different file
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
