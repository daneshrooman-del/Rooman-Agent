import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Horizontal progress indicator for multi-step flows. Collapses to a compact bar on mobile. */
export function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <nav aria-label="Avatar creation progress">
      {/* compact (mobile) */}
      <div className="sm:hidden">
        <p className="text-[12px] text-fg-subtle">
          Step <span className="tabular text-fg">{current + 1}</span> of {steps.length} · <span className="text-fg">{steps[current]}</span>
        </p>
        <div className="mt-2 flex gap-1.5" aria-hidden>
          {steps.map((s, i) => (
            <span
              key={s}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-500',
                i < current ? 'bg-accent/70' : i === current ? 'bg-accent-gradient' : 'bg-white/[0.08]',
              )}
            />
          ))}
        </div>
      </div>

      {/* full (tablet+) */}
      <ol className="hidden items-center gap-3 sm:flex">
        {steps.map((s, i) => {
          const state = i < current ? 'done' : i === current ? 'active' : 'todo'
          return (
            <li key={s} className="flex flex-1 items-center gap-3 last:flex-none" aria-current={state === 'active' ? 'step' : undefined}>
              <span className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold transition-all duration-500',
                    state === 'done' && 'border-accent/40 bg-accent/15 text-accent',
                    state === 'active' && 'border-transparent bg-fg text-canvas shadow-[0_0_0_4px_rgb(143_124_255/0.18)]',
                    state === 'todo' && 'border-line-strong text-fg-subtle',
                  )}
                >
                  {state === 'done' ? <Check className="size-3.5" aria-hidden /> : i + 1}
                </span>
                <span className={cn('whitespace-nowrap text-[13px] font-medium', state === 'todo' ? 'text-fg-subtle' : 'text-fg')}>
                  {s}
                  <span className="sr-only">{state === 'done' ? ' (completed)' : state === 'active' ? ' (current step)' : ''}</span>
                </span>
              </span>
              {i < steps.length - 1 && (
                <span aria-hidden className="relative h-px min-w-6 flex-1 overflow-hidden bg-white/[0.08]">
                  <span
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-700 ease-out-soft"
                    style={{ width: i < current ? '100%' : '0%' }}
                  />
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
