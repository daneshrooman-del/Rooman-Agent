import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

/** Lightweight dropdown menu with keyboard support (arrows, Esc, Home/End). */
export function Menu({
  trigger,
  items,
  align = 'end',
  label,
  className,
}: {
  trigger: (props: { 'aria-haspopup': 'menu'; 'aria-expanded': boolean; 'aria-controls': string; onClick: () => void; id: string }) => ReactNode
  items: MenuItem[]
  align?: 'start' | 'end'
  label: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const triggerId = useId()
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('[role=menuitem]:not([disabled])')?.focus())
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const focusItem = (dir: 1 | -1 | 0 | 'end') => {
    const els = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not([disabled])') ?? [])
    const i = els.indexOf(document.activeElement as HTMLButtonElement)
    const n = dir === 0 ? 0 : dir === 'end' ? els.length - 1 : (i + dir + els.length) % els.length
    els[n]?.focus()
  }

  return (
    <div ref={root} className={cn('relative inline-flex', className)}>
      {trigger({ 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': menuId, onClick: () => setOpen((o) => !o), id: triggerId })}
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          aria-labelledby={triggerId}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              document.getElementById(triggerId)?.focus()
            } else if (e.key === 'ArrowDown') focusItem(1)
            else if (e.key === 'ArrowUp') focusItem(-1)
            else if (e.key === 'Home') focusItem(0)
            else if (e.key === 'End') focusItem('end')
            else if (e.key === 'Tab') setOpen(false)
            else return
            e.preventDefault()
          }}
          className={cn(
            'glass-strong absolute top-full z-50 mt-2 min-w-48 animate-fade-up rounded-[14px] p-1.5 shadow-[0_24px_60px_-12px_rgb(0_0_0/0.85)]',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false)
                it.onSelect()
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[13px] transition-colors [&_svg]:size-4',
                'focus:outline-none focus-visible:bg-white/[0.08] disabled:opacity-40',
                it.danger ? 'text-danger hover:bg-danger/10' : 'text-fg-muted hover:bg-white/[0.07] hover:text-fg focus-visible:text-fg',
              )}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
