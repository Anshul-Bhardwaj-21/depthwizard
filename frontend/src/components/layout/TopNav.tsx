import { Link, useLocation } from 'react-router-dom';
import { Layers, HelpCircle } from 'lucide-react';

export function TopNav() {
  const location = useLocation();
  const isNewAnalysis = location.pathname.startsWith('/analyze');

  return (
    <header
      className="h-12 border-b flex items-center px-5 shrink-0 z-10"
      style={{
        borderColor: 'var(--color-dw-border)',
        backgroundColor: 'var(--color-dw-surface)',
      }}
    >
      {/* Logo / wordmark */}
      <Link
        to="/"
        className="flex items-center gap-2.5 text-slate-100 no-underline hover:text-white transition-colors"
        aria-label="DepthWizard — go to home"
      >
        <Layers
          size={18}
          className="text-sky-400"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <span className="font-semibold tracking-tight text-[13px]">
          DepthWizard
        </span>
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
          style={{
            color: 'var(--color-dw-accent)',
            borderColor: 'var(--color-dw-accent-dim)',
            backgroundColor: 'rgba(14,165,233,0.08)',
          }}
        >
          ALPHA
        </span>
      </Link>

      {/* Current context (breadcrumb-style) */}
      {isNewAnalysis && (
        <div
          className="ml-4 flex items-center gap-2 text-[12px]"
          style={{ color: 'var(--color-dw-text-dim)' }}
        >
          <span>/</span>
          <span style={{ color: 'var(--color-dw-text-sub)' }}>New Analysis</span>
        </div>
      )}

      {/* Right-side utility */}
      <div className="ml-auto flex items-center gap-3">
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-[12px] transition-colors hover:text-slate-200"
          style={{ color: 'var(--color-dw-text-dim)' }}
          aria-label="Documentation"
        >
          <HelpCircle size={14} aria-hidden="true" />
          <span className="hidden sm:inline">Docs</span>
        </a>

        {/* Backend status indicator */}
        <span
          className="flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded"
          style={{
            color: 'var(--color-dw-warning)',
            backgroundColor: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
          title="Backend not connected — demo mode"
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"
            aria-hidden="true"
          />
          BACKEND OFFLINE
        </span>
      </div>
    </header>
  );
}
