import { Clock } from 'lucide-react';
import type { InputMetadata } from '../../types/analysis';

interface MetadataPanelProps {
  metadata: InputMetadata;
}

interface MetaRowProps {
  label: string;
  value: string | null;
  isPending?: boolean;
  mono?: boolean;
}

function MetaRow({ label, value, isPending = false, mono = false }: MetaRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b last:border-b-0"
      style={{ borderColor: 'var(--color-dw-border-subtle)' }}
    >
      <span
        className="text-[11px] uppercase tracking-wide font-medium shrink-0"
        style={{ color: 'var(--color-dw-text-dim)' }}
      >
        {label}
      </span>
      {isPending || value === null ? (
        <span
          className="flex items-center gap-1.5 text-[11px]"
          style={{ color: 'var(--color-dw-text-dim)' }}
        >
          <Clock size={10} aria-hidden="true" />
          Awaiting inspection
        </span>
      ) : (
        <span
          className={['text-[12px] text-right', mono ? 'font-mono' : ''].join(' ')}
          style={{ color: 'var(--color-dw-text-sub)' }}
        >
          {value}
        </span>
      )}
    </div>
  );
}

export function MetadataPanel({ metadata }: MetadataPanelProps) {
  const isPending = metadata.status === 'PENDING' || metadata.status === 'INSPECTING';

  return (
    <section
      aria-label="Image metadata"
      className="rounded-lg border overflow-hidden"
      style={{
        borderColor: 'var(--color-dw-border)',
        backgroundColor: 'var(--color-dw-surface)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--color-dw-border)' }}
      >
        <span className="text-[11px] uppercase tracking-widest font-semibold"
          style={{ color: 'var(--color-dw-text-dim)' }}
        >
          Image Metadata
        </span>
        {isPending && (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{
              color: 'var(--color-dw-text-dim)',
              backgroundColor: 'var(--color-dw-surface-2)',
            }}
          >
            PENDING BACKEND
          </span>
        )}
      </div>

      {/* Rows */}
      <div className="px-4">
        <MetaRow
          label="Georeferencing"
          value={
            metadata.isGeoreferenced === null
              ? null
              : metadata.isGeoreferenced
              ? 'Available'
              : 'Not available'
          }
          isPending={isPending}
        />
        <MetaRow
          label="CRS"
          value={metadata.crs}
          isPending={isPending}
          mono
        />
        <MetaRow
          label="Dimensions"
          value={
            metadata.widthPx !== null && metadata.heightPx !== null
              ? `${metadata.widthPx.toLocaleString()} × ${metadata.heightPx.toLocaleString()} px`
              : null
          }
          isPending={isPending}
          mono
        />
        <MetaRow
          label="Resolution (GSD)"
          value={
            metadata.resolutionM !== null
              ? `${metadata.resolutionM.toFixed(2)} m/px`
              : null
          }
          isPending={isPending}
          mono
        />
        <MetaRow
          label="Band Count"
          value={metadata.bandCount?.toString() ?? null}
          isPending={isPending}
          mono
        />
        <MetaRow
          label="NoData Value"
          value={metadata.noDataValue?.toString() ?? null}
          isPending={isPending}
          mono
        />
      </div>
    </section>
  );
}
