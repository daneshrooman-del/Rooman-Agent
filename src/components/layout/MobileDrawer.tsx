import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { libraryNav, primaryNav, settingsNav } from '@/components/navigation/nav'
import { Logo } from '@/components/navigation/Logo'

/** Full navigation drawer for small screens (secondary destinations live here). */
export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  const link = (to: string, label: string, Icon: React.ComponentType<{ className?: string }>, end?: boolean, layer?: string) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      onClick={onClose}
      className={({ isActive }) => cn('flex h-12 items-center gap-3 rounded-[12px] px-3 text-[15px] font-medium', isActive ? 'bg-white/[0.07] text-fg' : 'text-fg-muted')}
    >
      <Icon className="size-5" />
      <span className="flex-1">{label}</span>
      {layer && <span className="text-[11px] text-fg-subtle">{layer}</span>}
    </NavLink>
  )

  return (
    <dialog
      ref={ref}
      aria-label="Navigation"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="glass-strong m-0 h-dvh max-h-none w-[86vw] max-w-xs rounded-r-[24px] border-l-0 p-0 text-fg backdrop:bg-black/60 open:animate-fade-in lg:hidden"
    >
      {open && (
        <div className="flex h-full flex-col p-4">
          <div className="flex items-center justify-between">
            <Logo />
            <button type="button" onClick={onClose} aria-label="Close navigation" className="flex size-10 items-center justify-center rounded-[10px] text-fg-muted hover:bg-white/[0.06]">
              <X className="size-5" />
            </button>
          </div>
          <nav className="mt-6 flex flex-col gap-1" aria-label="Main">
            {primaryNav.map((n) => link(n.to, n.label, n.icon, n.end, n.layer))}
            <p className="mb-1 mt-5 px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-fg-subtle">Library</p>
            {libraryNav.map((n) => link(n.to, n.label, n.icon))}
          </nav>
          <div className="mt-auto border-t border-line pt-3">{link(settingsNav.to, settingsNav.label, settingsNav.icon)}</div>
        </div>
      )}
    </dialog>
  )
}
