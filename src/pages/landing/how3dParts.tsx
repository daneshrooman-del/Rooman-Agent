import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/* Small building blocks for the How it works prism faces. */

export function Photo({ src, children, className }: { src: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('relative size-full', className)}>
      <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      {children}
    </div>
  )
}

export function Label({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <span className={cn('absolute left-4 top-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-semibold', dark ? 'bg-[var(--ink)] text-[var(--on-ink)]' : 'bg-[var(--bg)]/95 text-[var(--ink)]')}>
      {children}
    </span>
  )
}

export function Corners() {
  const c = 'absolute size-8 border-white'
  return (
    <>
      <span className={cn(c, 'left-5 top-14 border-l-[3px] border-t-[3px]')} />
      <span className={cn(c, 'right-5 top-14 border-r-[3px] border-t-[3px]')} />
      <span className={cn(c, 'bottom-5 left-5 border-b-[3px] border-l-[3px]')} />
      <span className={cn(c, 'bottom-5 right-5 border-b-[3px] border-r-[3px]')} />
    </>
  )
}

export function Wave({ n = 26, className }: { n?: number; className?: string }) {
  return (
    <span className={cn('flex h-8 items-center justify-center gap-[3px]', className)} aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="w-[3px] animate-wave rounded-full bg-[var(--accent)]" style={{ height: `${30 + ((i * 37) % 65)}%`, animationDelay: `${(i % 7) * 90}ms` }} />
      ))}
    </span>
  )
}

