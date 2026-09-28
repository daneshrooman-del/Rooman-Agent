import { useId } from 'react'
import { cn } from '@/lib/cn'

export function LogoMark({ className }: { className?: string }) {
  const id = 'logo' + useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b3a2ff" />
          <stop offset="1" stopColor="#5b8dff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="#14141b" stroke="rgb(255 255 255 / 0.1)" />
      <circle cx="16" cy="12.5" r="4.6" fill={`url(#${id})`} />
      <path d="M7 25.5c1.6-4.8 5.2-7.2 9-7.2s7.4 2.4 9 7.2" fill="none" stroke={`url(#${id})`} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed && <span className="font-display text-[17px] font-semibold tracking-tight">Persona</span>}
    </span>
  )
}
