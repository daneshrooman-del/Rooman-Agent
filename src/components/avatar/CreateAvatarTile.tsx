import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Final grid tile inviting the user to create another avatar. */
export function CreateAvatarTile({ className }: { className?: string }) {
  return (
    <Link
      to="/avatars/new"
      className={cn(
        'group relative flex min-h-[320px] flex-col items-center justify-center overflow-hidden rounded-panel border border-dashed border-line-strong bg-white/[0.015] p-8 text-center',
        'transition-[border-color,background-color,transform] duration-300 ease-out-soft hover:-translate-y-1 hover:border-accent/45 hover:bg-accent/[0.035]',
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 grid-lines opacity-30 [mask-image:radial-gradient(55%_55%_at_50%_45%,black,transparent)]" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[38%] size-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
      <span className="relative flex size-14 items-center justify-center rounded-full border border-line-strong bg-white/[0.04] text-fg transition-all duration-300 group-hover:border-accent/50 group-hover:shadow-glow">
        <Plus className="size-6 transition-transform duration-300 group-hover:rotate-90" aria-hidden />
      </span>
      <p className="relative mt-5 text-[16px] font-semibold">Create new avatar</p>
      <p className="relative mt-1.5 max-w-[240px] text-[13px] text-fg-muted">
        Upload a short video and train another reusable digital identity.
      </p>
      <span className="relative mt-5 text-[12px] font-medium text-fg-subtle transition-colors group-hover:text-accent">About 5 minutes of footage</span>
    </Link>
  )
}
