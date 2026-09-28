import { cn } from '@/lib/cn'
import { Badge, type BadgeTone } from './Badge'

export type StatusKind =
  | 'ready'
  | 'live'
  | 'online'
  | 'training'
  | 'generating'
  | 'processing'
  | 'queued'
  | 'failed'
  | 'paused'
  | 'draft'
  | 'offline'
  | 'deploying'
  | 'loading'

const map: Record<StatusKind, { label: string; tone: BadgeTone; dot: string; pulse?: boolean }> = {
  ready: { label: 'Ready', tone: 'success', dot: 'bg-success' },
  live: { label: 'Live', tone: 'live', dot: 'bg-live', pulse: true },
  online: { label: 'Online', tone: 'success', dot: 'bg-success', pulse: true },
  training: { label: 'Training', tone: 'accent', dot: 'bg-accent', pulse: true },
  generating: { label: 'Generating', tone: 'accent', dot: 'bg-accent', pulse: true },
  processing: { label: 'Processing', tone: 'info', dot: 'bg-info', pulse: true },
  queued: { label: 'Queued', tone: 'neutral', dot: 'bg-fg-subtle' },
  failed: { label: 'Failed', tone: 'danger', dot: 'bg-danger' },
  paused: { label: 'Paused', tone: 'warning', dot: 'bg-warning' },
  draft: { label: 'Draft', tone: 'neutral', dot: 'bg-fg-subtle' },
  offline: { label: 'Offline', tone: 'neutral', dot: 'bg-fg-subtle' },
  deploying: { label: 'Deploying', tone: 'info', dot: 'bg-info', pulse: true },
  loading: { label: 'Loading', tone: 'neutral', dot: 'bg-fg-subtle', pulse: true },
}

export function StatusDot({ status, className }: { status: StatusKind; className?: string }) {
  const m = map[status]
  return (
    <span className={cn('relative inline-flex size-2 shrink-0', className)} aria-hidden>
      {m.pulse && <span className={cn('absolute inset-0 animate-ring rounded-full', m.dot)} />}
      <span className={cn('relative inline-flex size-2 rounded-full', m.dot)} />
    </span>
  )
}

/** One status language for avatars, videos, agents, knowledge and sessions. */
export function StatusIndicator({
  status,
  label,
  variant = 'badge',
  className,
}: {
  status: StatusKind
  label?: string
  variant?: 'badge' | 'inline'
  className?: string
}) {
  const m = map[status]
  const text = label ?? m.label
  if (variant === 'inline') {
    return (
      <span className={cn('inline-flex items-center gap-2 text-[13px] text-fg-muted', className)}>
        <StatusDot status={status} />
        <span>{text}</span>
      </span>
    )
  }
  return (
    <Badge tone={m.tone} className={className} icon={<StatusDot status={status} />}>
      {text}
    </Badge>
  )
}
