import { Fragment } from 'react';
import { Check, Lock } from 'lucide-react';
import type { PipelineStageId } from '../../types/analysis';
import { PIPELINE_STAGES } from '../../types/analysis';

interface PipelineStepsProps {
  /** The currently active stage. Stages after this one are locked. */
  activeStage: PipelineStageId;
}

export function PipelineSteps({ activeStage }: PipelineStepsProps) {
  const activeIndex = PIPELINE_STAGES.findIndex((s) => s.id === activeStage);

  return (
    <nav
      aria-label="Analysis pipeline stages"
      className="flex items-center gap-0"
    >
      {PIPELINE_STAGES.map((stage, i) => {
        const isCompleted = i < activeIndex;
        const isActive = i === activeIndex;
        const isLocked = i > activeIndex;

        return (
          <Fragment key={stage.id}>
            {/* Stage node */}
            <div
              className="flex items-center gap-2"
              aria-current={isActive ? 'step' : undefined}
            >
              {/* Step circle */}
              <div
                className={[
                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold font-mono border transition-colors shrink-0',
                  isCompleted
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : isActive
                    ? 'bg-sky-500 border-sky-400 text-white'
                    : 'bg-transparent border-slate-700 text-slate-600',
                ].join(' ')}
                aria-hidden="true"
              >
                {isCompleted ? (
                  <Check size={10} strokeWidth={3} />
                ) : isLocked ? (
                  <Lock size={9} strokeWidth={2} />
                ) : (
                  stage.step
                )}
              </div>

              {/* Label */}
              <span
                className={[
                  'text-[11px] font-medium tracking-wide uppercase',
                  isActive
                    ? 'text-sky-400'
                    : isCompleted
                    ? 'text-emerald-400'
                    : 'text-slate-600',
                ].join(' ')}
              >
                {stage.label}
              </span>
            </div>

            {/* Connector */}
            {i < PIPELINE_STAGES.length - 1 && (
              <div
                className={[
                  'w-8 h-px mx-2 shrink-0',
                  isCompleted ? 'bg-emerald-700' : 'bg-slate-800',
                ].join(' ')}
                aria-hidden="true"
              />
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
