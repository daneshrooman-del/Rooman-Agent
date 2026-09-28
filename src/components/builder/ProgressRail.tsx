import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { STAGES } from './useBuilder'

/** UNDERSTAND → … → DEPLOY. `stage` = index of active stage; ≥ STAGES.length means complete; < 0 idle. */
export function ProgressRail({ stage }: { stage: number }) {
  const done = stage >= STAGES.length
  const pct = stage < 0 ? 0 : done ? 100 : (stage / (STAGES.length - 1)) * 100
  const current = done ? 'Complete' : stage < 0 ? 'Waiting for your description' : STAGES[stage]

  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3 sm:px-5" aria-live="polite">
      <p className="sr-only">{done ? 'Build complete' : `Build stage: ${current}`}</p>

      {/* mobile: compact */}
      <div className="md:hidden" aria-hidden>
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-medium uppercase tracking-[0.14em] text-fg-subtle">
            {done ? 'Ready' : stage < 0 ? 'Builder' : `Step ${stage + 1} of ${STAGES.length}`}
          </span>
          <span className={cn('font-medium', done ? 'text-success' : 'text-fg')}>{current}</span>
        </div>
        <div className="mt-2.5 flex gap-1">
          {STAGES.map((s, i) => (
            <span
              key={s}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-500',
                i < stage || done ? 'bg-accent' : i === stage ? 'animate-pulse-soft bg-accent/60' : 'bg-white/[0.08]',
              )}
            />
          ))}
        </div>
      </div>

      {/* desktop: full rail */}
      <ol className="relative hidden items-center justify-between md:flex">
        <span aria-hidden className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-white/[0.07]" />
        <span
          aria-hidden
          className="absolute left-3 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-accent-2 to-accent transition-[width] duration-700 ease-out-soft"
          style={{ width: `calc((100% - 1.5rem) * ${pct / 100})` }}
        />
        {STAGES.map((s, i) => {
          const st = done || i < stage ? 'done' : i === stage ? 'active' : 'todo'
          return (
            <li key={s} className="relative flex items-center gap-2 bg-surface px-2 first:pl-0 last:pr-0" aria-current={st === 'active' ? 'step' : undefined}>
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold transition-all duration-500',
                  st === 'done' && 'border-accent/50 bg-accent/15 text-[#c6bcff]',
                  st === 'active' && 'border-accent bg-accent/20 text-fg shadow-[0_0_0_4px_rgb(143_124_255/0.14),0_0_18px_rgb(143_124_255/0.45)]',
                  st === 'todo' && 'border-line-strong text-fg-subtle',
                )}
              >
                {st === 'done' ? <Check className="size-3" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors duration-500',
                  st === 'todo' ? 'text-fg-subtle' : 'text-fg',
                )}
              >
                {s}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
