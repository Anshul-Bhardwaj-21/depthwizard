import { useNavigate } from 'react-router-dom';
import { ArrowRight, Layers, GitBranch, Cpu, Satellite } from 'lucide-react';
import { Button } from '../components/ui/Button';

interface PipelineNodeProps {
  label: string;
  sub?: string;
  accent?: boolean;
}

function PipelineNode({ label, sub, accent }: PipelineNodeProps) {
  return (
    <div
      className={[
        'rounded-lg border px-4 py-3 min-w-[148px] text-center',
        accent
          ? 'border-sky-700/60 bg-sky-950/30'
          : 'border-slate-800 bg-slate-900/60',
      ].join(' ')}
    >
      <p
        className={[
          'text-[12px] font-semibold',
          accent ? 'text-sky-300' : 'text-slate-300',
        ].join(' ')}
      >
        {label}
      </p>
      {sub && (
        <p className="text-[10px] font-mono mt-0.5 text-slate-600">{sub}</p>
      )}
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex flex-col items-center py-1" aria-hidden="true">
      <div className="w-px h-5 bg-slate-800" />
      <div className="w-2 h-2 border-r-2 border-b-2 border-slate-700 rotate-45 -mt-1" />
    </div>
  );
}

export function WorkspacePage() {
  const navigate = useNavigate();

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-6 py-16"
      style={{ backgroundColor: 'var(--color-dw-bg)' }}
    >
      <div className="w-full max-w-2xl">
        {/* Title block */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={16} className="text-sky-400" strokeWidth={1.5} aria-hidden="true" />
            <span
              className="text-[11px] font-mono tracking-widest uppercase"
              style={{ color: 'var(--color-dw-text-dim)' }}
            >
              Smart India Hackathon · Remote Sensing
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100 mb-2">
            Single-View Height Estimation
            <br />
            <span className="text-sky-400">& 3D Flythrough</span>
          </h1>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-dw-text-sub)' }}>
            Submit a single optical remote-sensing image. DepthWizard estimates
            building heights and terrain elevation, producing a Digital Surface
            Model (DSM) and an interactive 3D flythrough without requiring
            stereo pairs or LiDAR ground truth.
          </p>
        </div>

        {/* Pipeline diagram */}
        <div
          className="rounded-xl border p-6 mb-10"
          style={{
            borderColor: 'var(--color-dw-border)',
            backgroundColor: 'var(--color-dw-surface)',
          }}
          aria-label="Processing pipeline overview"
        >
          <p
            className="text-[10px] font-mono uppercase tracking-widest mb-5"
            style={{ color: 'var(--color-dw-text-dim)' }}
          >
            Processing Pipeline
          </p>

          <div className="flex flex-col items-center">
            <PipelineNode
              label="Optical Imagery"
              sub="PNG / JPEG / TIFF / GeoTIFF"
              accent
            />
            <Arrow />
            <PipelineNode label="Input Inspection" sub="georeferencing · CRS · GSD" />
            <Arrow />
            <PipelineNode label="ML Depth / Elevation" sub="single-view height model" />
            <Arrow />
            <PipelineNode label="Scale Calibration" sub="shadow · RANSAC · reference" />
            <Arrow />
            <PipelineNode label="DSM · GeoTIFF Output" sub="elevation raster" />
            <Arrow />
            {/* Branch */}
            <div className="flex items-start gap-6">
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-slate-800" aria-hidden="true" />
                <PipelineNode label="2D Analysis" sub="slope · height map" />
              </div>
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-slate-800" aria-hidden="true" />
                <PipelineNode label="3D Flythrough" sub="terrain visualisation" />
              </div>
            </div>
            <Arrow />
            <PipelineNode label="Validation" sub="RMSE · MAE · reference DEM" />
            <Arrow />
            <PipelineNode label="Export / Report" sub="GeoTIFF · PNG · CSV" />
          </div>
        </div>

        {/* Feature badges */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { icon: Satellite, text: 'Single-view input' },
            { icon: GitBranch, text: 'No stereo pairs required' },
            { icon: Cpu, text: 'ML height estimation' },
          ].map(({ icon: Icon, text }) => (
            <span
              key={text}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border"
              style={{
                color: 'var(--color-dw-text-sub)',
                borderColor: 'var(--color-dw-border)',
                backgroundColor: 'var(--color-dw-surface-2)',
              }}
            >
              <Icon size={12} aria-hidden="true" />
              {text}
            </span>
          ))}
        </div>

        {/* CTA */}
        <Button
          variant="primary"
          size="lg"
          onClick={() => navigate('/analyze/new')}
          id="start-analysis-btn"
          className="gap-3"
        >
          Start New Analysis
          <ArrowRight size={16} aria-hidden="true" />
        </Button>

        {/* Demo note */}
        <p
          className="mt-4 text-[11px]"
          style={{ color: 'var(--color-dw-text-dim)' }}
        >
          Demo mode — backend not connected. Upload and validation run
          client-side only.
        </p>
      </div>
    </div>
  );
}
