import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { AvatarPreview, type AvatarLike } from '@/components/avatar/AvatarPreview'

/** Viewfinder corner brackets for a cinematic, "capture in progress" frame. */
function Brackets() {
  const c = 'absolute size-6 border-white/40'
  return (
    <div aria-hidden className="pointer-events-none absolute inset-4 sm:inset-6">
      <span className={cn(c, 'left-0 top-0 rounded-tl-[10px] border-l border-t')} />
      <span className={cn(c, 'right-0 top-0 rounded-tr-[10px] border-r border-t')} />
      <span className={cn(c, 'bottom-0 left-0 rounded-bl-[10px] border-b border-l')} />
      <span className={cn(c, 'bottom-0 right-0 rounded-br-[10px] border-b border-r')} />
    </div>
  )
}

/** Large avatar stage with ambient glow, used for processing + ready states. */
export function TrainingStage({
  avatar,
  scanning,
  alive,
  children,
  className,
}: {
  avatar: AvatarLike
  scanning?: boolean
  alive?: boolean
  children?: ReactNode
  className?: string
}) {
  const hue = avatar.hue
  return (
    <div className={cn('relative', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-3 animate-pulse-soft sm:-inset-10 rounded-full opacity-70 blur-3xl"
        style={{ background: `radial-gradient(50% 50% at 50% 45%, hsl(${hue} 80% 55% / 0.35), transparent 70%)` }}
      />
      <AvatarPreview
        avatar={avatar}
        scanning={scanning}
        alive={alive}
        rounded="rounded-hero"
        className="relative aspect-[4/4.4] w-full border border-white/[0.08] shadow-[0_40px_120px_-40px_rgb(0_0_0/0.9)] sm:aspect-[4/4.6]"
      >
        {scanning && <Brackets />}
        {children}
      </AvatarPreview>
    </div>
  )
}
