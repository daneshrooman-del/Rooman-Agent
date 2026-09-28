import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'live'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-white/[0.06] text-fg-muted border-white/[0.08]',
  accent: 'bg-accent/12 text-[#c6bcff] border-accent/25',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger: 'bg-danger/10 text-[#ff8a95] border-danger/20',
  info: 'bg-info/10 text-[#a3c0ff] border-info/20',
  live: 'bg-live/12 text-[#ff8e9c] border-live/25',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
  icon,
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
  icon?: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[12px] font-medium leading-none [&_svg]:size-3',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}
