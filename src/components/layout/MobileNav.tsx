import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { primaryNav } from '@/components/navigation/nav'
import { Dialog } from '@/components/ui/Dialog'
import { createActions } from './CreateMenu'

const descriptions: Record<string, string> = {
  '/avatars/new': 'Turn a short video into your digital twin',
  '/create': 'Direct your avatar in a new video',
  '/live': 'Talk to your avatar in real time',
  '/agents/new': 'Describe a job, deploy an AI agent',
}

/** Bottom tab bar for phones/tablets. Create sits at the center. */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  const [home, avatars, , live, agents] = primaryNav
  const tabs = [home, avatars, null, live, agents]

  return (
    <>
      <nav
        aria-label="Primary"
        className="glass-strong fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center px-2">
          {tabs.map((item) =>
            item === null ? (
              <li key="create" className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  aria-label="Create"
                  className="flex size-12 items-center justify-center rounded-[16px] bg-fg text-canvas shadow-[0_10px_30px_-8px_rgb(255_255_255/0.35)] transition-transform active:scale-95"
                >
                  <Plus className="size-5" />
                </button>
              </li>
            ) : (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn('flex h-14 flex-col items-center justify-center gap-1 rounded-[12px] text-[11px] font-medium transition-colors', isActive ? 'text-fg' : 'text-fg-subtle')
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={cn('size-5', isActive && 'text-fg')} aria-hidden />
                      {item.short ?? item.label}
                    </>
                  )}
                </NavLink>
              </li>
            ),
          )}
        </ul>
      </nav>

      <Dialog open={open} onClose={() => setOpen(false)} title="Create something new" description="Everything starts from your avatar.">
        <div className="grid grid-cols-2 gap-3">
          {createActions.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              onClick={() => setOpen(false)}
              className="flex flex-col gap-3 rounded-card border border-line bg-white/[0.03] p-4 transition-colors active:bg-white/[0.07]"
            >
              <span className="flex size-10 items-center justify-center rounded-[12px] bg-white/[0.06]">
                <a.icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block text-[14px] font-medium">{a.label}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-fg-muted">{descriptions[a.to]}</span>
              </span>
            </Link>
          ))}
        </div>
      </Dialog>
    </>
  )
}
