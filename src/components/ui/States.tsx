import type { ReactNode } from 'react'
import { AlertTriangle, Check, Loader2, WifiOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

/* ------------------------------------------------------------ Empty */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center overflow-hidden rounded-panel border border-dashed border-line-strong text-center',
        compact ? 'px-6 py-10' : 'px-6 py-16 sm:py-20',
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(143_124_255/0.12),transparent)]" />
      {icon && (
        <div className="relative mb-5 flex size-14 items-center justify-center rounded-[18px] border border-line-strong bg-white/[0.04] text-fg [&_svg]:size-6">
          {icon}
        </div>
      )}
      <h3 className="relative text-lg font-semibold">{title}</h3>
      {description && <p className="relative mt-2 max-w-sm text-[14px] text-fg-muted">{description}</p>}
      {action && <div className="relative mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------ Error */
export function ErrorState({ title = 'Something went wrong', description, onRetry }: { title?: string; description?: ReactNode; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={<AlertTriangle className="text-danger" />}
      title={title}
      description={description ?? 'We could not load this right now. Your work is safe.'}
      action={onRetry && <Button onClick={onRetry}>Try again</Button>}
    />
  )
}

export function OfflineState() {
  return (
    <EmptyState
      icon={<WifiOff />}
      title="You're offline"
      description="Reconnect to the internet to generate videos, go live and sync agents."
      compact
    />
  )
}

/* ------------------------------------------------------------ Loading */
export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 className={cn('size-4 animate-spin text-fg-muted', className)} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton rounded-[10px]', className)} />
}

export function PageLoader() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-label="Loading page">
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/3] rounded-card" />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ Progress */
export function ProgressBar({ value, className, label }: { value: number; className?: string; label?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      aria-label={label}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]', className)}
    >
      <div
        className="relative h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-300 ease-out-soft"
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      >
        <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.45),transparent)] bg-[length:200%_100%]" />
      </div>
    </div>
  )
}

/** Vertical list of pipeline stages — used for training, rendering and agent builds. */
export function StageList({ stages, current, done }: { stages: string[]; current: number; done?: boolean }) {
  return (
    <ol className="flex flex-col gap-1" aria-live="polite">
      {stages.map((s, i) => {
        const state = done || i < current ? 'done' : i === current ? 'active' : 'todo'
        return (
          <li
            key={s}
            className={cn(
              'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] transition-all duration-500',
              state === 'active' && 'bg-white/[0.05] text-fg',
              state === 'done' && 'text-fg-muted',
              state === 'todo' && 'text-fg-subtle',
            )}
            aria-current={state === 'active' ? 'step' : undefined}
          >
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] transition-all duration-500',
                state === 'done' && 'border-success/40 bg-success/15 text-success',
                state === 'active' && 'border-accent/60 bg-accent/15 text-fg',
                state === 'todo' && 'border-line-strong',
              )}
            >
              {state === 'done' ? <Check className="size-3.5" /> : state === 'active' ? <Loader2 className="size-3.5 animate-spin" /> : i + 1}
            </span>
            <span className="flex-1">{s}</span>
            {state === 'active' && <span className="text-[12px] text-accent">In progress</span>}
          </li>
        )
      })}
    </ol>
  )
}

/* ------------------------------------------------------------ Demo notice */
export function DemoNote({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <p className={cn('inline-flex items-center gap-2 text-[12px] text-fg-subtle', className)}>
      <span className="rounded-[5px] border border-warning/25 bg-warning/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-warning">Demo</span>
      {children ?? 'Sample data — connect your backend to see real activity.'}
    </p>
  )
}
