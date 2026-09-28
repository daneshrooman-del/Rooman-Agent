import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  count?: number
}

/** Underline tabs with roving focus. Pair each panel with id `${idBase}-panel-${value}`. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  idBase = 'tabs',
  className,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (v: T) => void
  label: string
  idBase?: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const move = (dir: 1 | -1 | 'home' | 'end') => {
    const i = items.findIndex((t) => t.value === value)
    const n = dir === 'home' ? 0 : dir === 'end' ? items.length - 1 : (i + dir + items.length) % items.length
    onChange(items[n].value)
    ref.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[n]?.focus()
  }
  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      className={cn('no-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b border-line px-1', className)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') move(1)
        else if (e.key === 'ArrowLeft') move(-1)
        else if (e.key === 'Home') move('home')
        else if (e.key === 'End') move('end')
        else return
        e.preventDefault()
      }}
    >
      {items.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            id={`${idBase}-tab-${t.value}`}
            aria-selected={active}
            aria-controls={`${idBase}-panel-${t.value}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cn(
              'relative inline-flex h-11 shrink-0 items-center gap-2 px-3 text-[13px] font-medium transition-colors [&_svg]:size-4',
              active ? 'text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span className={cn('tabular rounded-full px-1.5 text-[11px]', active ? 'bg-white/10 text-fg' : 'bg-white/[0.05] text-fg-subtle')}>{t.count}</span>
            )}
            <span
              aria-hidden
              className={cn(
                'absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-accent to-accent-2 transition-opacity duration-200',
                active ? 'opacity-100' : 'opacity-0',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ idBase = 'tabs', value, children, className }: { idBase?: string; value: string; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel-${value}`} aria-labelledby={`${idBase}-tab-${value}`} className={cn('animate-fade-in', className)}>
      {children}
    </div>
  )
}
