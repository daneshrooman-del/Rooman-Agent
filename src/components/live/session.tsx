/* Small pieces used by the Live AI page: clock, avatar switcher, self-view, captions. */
import { useEffect, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDuration } from '@/lib/format'
import { useWorkspace } from '@/state/workspace'
import { Menu } from '@/components/ui'
import { AvatarChip } from '@/components/avatar/AvatarPreview'

/** Elapsed seconds since `startedAt`, ticking once a second while running. */
export function useSessionClock(startedAt: number | null, running: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [running])
  return startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0
}

export function SessionTimer({ seconds, className }: { seconds: number; className?: string }) {
  return (
    <span className={cn('tabular text-[13px] text-fg-muted', className)} aria-label={`Session time ${formatDuration(seconds)}`}>
      {formatDuration(seconds) || '0:00'}
    </span>
  )
}

/** Compact dropdown to switch which avatar you are talking to. */
export function AvatarSwitcher({ value, onChange, className }: { value: string; onChange: (id: string) => void; className?: string }) {
  const { data, avatarById } = useWorkspace()
  const ready = (data?.avatars ?? []).filter((a) => a.status === 'ready')
  const current = avatarById(value)
  return (
    <Menu
      label="Switch avatar"
      className={className}
      items={ready.map((a) => ({
        label: `${a.name} — ${a.kind}`,
        icon: a.id === value ? <Check aria-hidden /> : <AvatarChip avatar={a} size={16} />,
        onSelect: () => onChange(a.id),
      }))}
      trigger={(p) => (
        <button
          type="button"
          {...p}
          aria-label={`Avatar: ${current?.name ?? 'none'}. Switch avatar`}
          className="glass-strong inline-flex h-10 items-center gap-2 rounded-full pl-1.5 pr-3 text-[13px] font-medium text-fg transition-colors hover:bg-white/[0.08]"
        >
          <AvatarChip avatar={current} size={28} />
          <span className="max-w-[9rem] truncate">{current?.name}</span>
          <ChevronDown className="size-3.5 text-fg-subtle" aria-hidden />
        </button>
      )}
    />
  )
}

/** Stylized self-view placeholder — no real camera is accessed. */
export function SelfViewTile({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <div
      className={cn(
        'glass-strong flex h-32 w-24 animate-fade-in flex-col items-center justify-center gap-2 overflow-hidden rounded-card sm:h-40 sm:w-32',
        'bg-[radial-gradient(80%_60%_at_50%_20%,rgb(91_141_255/0.2),transparent)] shadow-soft',
        className,
      )}
      role="img"
      aria-label="Your camera preview (placeholder)"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-white/10 text-[15px] font-semibold ring-1 ring-white/15 sm:size-14 sm:text-[17px]">
        {initials}
      </span>
      <span className="inline-flex items-center gap-1.5 text-[11px] text-fg-muted">
        <span className="size-1.5 rounded-full bg-success" aria-hidden />
        Camera on
      </span>
    </div>
  )
}

/** On-stage caption of the avatar's latest line. */
export function Captions({ text, className }: { text: string | undefined; className?: string }) {
  if (!text) return null
  const shown = text.length > 180 ? `…${text.slice(-180)}` : text
  return (
    <p aria-hidden className={cn('mx-auto max-w-2xl text-balance text-center text-[15px] leading-relaxed text-white/95 [text-shadow:0_2px_12px_rgb(0_0_0/0.8)] sm:text-[17px]', className)}>
      {shown}
    </p>
  )
}
