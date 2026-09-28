import { useId } from 'react'
import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/cn'

/** "Avatar consistency: Verified" with an on-hover / on-focus explanation. */
export function ConsistencyBadge({ avatarName, className, align = 'start' }: { avatarName?: string; className?: string; align?: 'start' | 'end' }) {
  const tip = useId()
  return (
    <span className={cn('group/tip relative inline-flex', className)}>
      <span
        tabIndex={0}
        aria-describedby={tip}
        className="inline-flex h-7 cursor-help items-center gap-1.5 rounded-full border border-success/25 bg-success/10 pl-2 pr-2.5 text-[12px] font-medium text-success outline-none transition-colors hover:bg-success/15 focus-visible:ring-2 focus-visible:ring-success/40"
      >
        <ShieldCheck className="size-3.5" aria-hidden />
        Avatar consistency: Verified
      </span>
      <span
        id={tip}
        role="tooltip"
        className={cn(
          'glass-strong pointer-events-none absolute top-full z-30 mt-2 w-64 translate-y-1 rounded-[12px] px-3.5 py-2.5 text-[12px] leading-relaxed text-fg-muted opacity-0 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.8)] transition-all duration-200',
          'group-focus-within/tip:translate-y-0 group-focus-within/tip:opacity-100 group-hover/tip:translate-y-0 group-hover/tip:opacity-100',
          align === 'end' ? 'right-0' : 'left-0',
        )}
      >
        Same identity as {avatarName ? `${avatarName}’s` : 'the'} reference — face, voice, and motion match.
      </span>
    </span>
  )
}
