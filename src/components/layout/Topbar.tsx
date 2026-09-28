import { Link, useNavigate } from 'react-router-dom'
import { Bell, Check, ChevronsUpDown, LogOut, Menu as MenuIcon, Plus, Search, Settings, UserRound } from 'lucide-react'
import { useWorkspace } from '@/state/workspace'
import { timeAgo } from '@/lib/format'
import { Menu } from '@/components/ui/Menu'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { LogoMark } from '@/components/navigation/Logo'
import { CreateMenu } from './CreateMenu'

export function Topbar({ onSearch, onOpenDrawer }: { onSearch: () => void; onOpenDrawer: () => void }) {
  const { data, isDemo } = useWorkspace()
  const navigate = useNavigate()
  const toast = useToast()

  const notifications = [
    ...(data?.videos ?? []).filter((v) => v.status === 'ready').slice(0, 1).map((v) => ({ id: v.id, text: `“${v.title}” is ready`, at: v.createdAt, to: `/videos?v=${v.id}` })),
    ...(data?.avatars ?? []).filter((a) => a.status === 'training').map((a) => ({ id: a.id, text: `${a.name} is training · ${a.trainingProgress ?? 0}%`, at: a.createdAt, to: `/avatars/${a.id}` })),
    ...(data?.agents ?? []).flatMap((ag) => ag.activity.filter((x) => x.kind === 'handoff').map((x) => ({ id: x.id, text: `${ag.name}: ${x.text}`, at: x.at, to: `/agents/${ag.id}` }))),
  ]

  const initials = data?.user.name.split(' ').map((p) => p[0]).join('').slice(0, 2) ?? ''

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-canvas/70 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      {/* mobile: menu + logo */}
      <button type="button" onClick={onOpenDrawer} aria-label="Open navigation" className="-ml-1 flex size-10 items-center justify-center rounded-[10px] text-fg-muted hover:bg-white/[0.06] lg:hidden">
        <MenuIcon className="size-5" />
      </button>
      <Link to="/" aria-label="Persona home" className="lg:hidden">
        <LogoMark className="size-7" />
      </Link>

      {/* workspace selector */}
      <div className="hidden md:block">
      <Menu
        label="Workspace"
        align="start"
        trigger={(p) => (
          <button type="button" {...p} className="flex h-9 items-center gap-2 rounded-[10px] px-2.5 text-[13px] font-medium text-fg hover:bg-white/[0.06]">
            <span className="flex size-5 items-center justify-center rounded-[6px] bg-gradient-to-br from-accent to-accent-2 text-[10px] font-bold text-white">
              {data?.workspace.name[0] ?? 'R'}
            </span>
            {data?.workspace.name ?? 'Workspace'}
            <span className="rounded-full border border-line-strong px-1.5 text-[10px] text-fg-muted">{data?.workspace.plan}</span>
            <ChevronsUpDown className="size-3.5 text-fg-subtle" />
          </button>
        )}
        items={[
          { label: data?.workspace.name ?? 'Workspace', icon: <Check />, onSelect: () => {} },
          { label: 'Workspace settings', icon: <Settings />, onSelect: () => navigate('/settings?section=workspace') },
        ]}
      />
      </div>

      {/* search */}
      <button
        type="button"
        onClick={onSearch}
        className="ml-auto flex h-9 min-w-0 items-center gap-2.5 rounded-[10px] border border-line bg-white/[0.03] px-3 text-[13px] text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted md:ml-4 md:w-72 lg:w-80"
        aria-label="Search (Ctrl+K)"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden truncate sm:inline">Search avatars, videos, agents…</span>
        <kbd className="ml-auto hidden rounded-md border border-line-strong px-1.5 py-px text-[10px] md:inline">Ctrl K</kbd>
      </button>

      <div className="flex items-center gap-1.5 md:ml-auto">
        {isDemo && (
          <span className="hidden rounded-full border border-warning/25 bg-warning/10 px-2.5 py-1 text-[11px] font-medium text-warning xl:inline" title="No backend configured (VITE_API_URL). Showing sample workspace.">
            Demo data
          </span>
        )}

        <Menu
          label="Notifications"
          trigger={(p) => (
            <button type="button" {...p} aria-label={`Notifications (${notifications.length})`} className="relative flex size-9 items-center justify-center rounded-[10px] text-fg-muted hover:bg-white/[0.06] hover:text-fg">
              <Bell className="size-[18px]" />
              {notifications.length > 0 && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-accent ring-2 ring-canvas" />}
            </button>
          )}
          items={
            notifications.length
              ? notifications.map((n) => ({ label: `${n.text} · ${timeAgo(n.at)}`, onSelect: () => navigate(n.to) }))
              : [{ label: 'You are all caught up', onSelect: () => {}, disabled: true }]
          }
        />

        <div className="hidden sm:block lg:hidden">
        <CreateMenu
          trigger={(p) => (
            <Button {...p} variant="primary" size="sm" leftIcon={<Plus />}>
              Create
            </Button>
          )}
        />
        </div>

        <Menu
          label="Account"
          trigger={(p) => (
            <button type="button" {...p} aria-label="Account menu" className="ml-1 flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3a3350] to-[#1d2238] text-[12px] font-semibold ring-1 ring-white/10 transition hover:ring-white/25">
              {initials}
            </button>
          )}
          items={[
            { label: 'Profile', icon: <UserRound />, onSelect: () => navigate('/settings?section=profile') },
            { label: 'Settings', icon: <Settings />, onSelect: () => navigate('/settings') },
            { label: 'Sign out', icon: <LogOut />, onSelect: () => toast({ title: 'Sign-out is handled by your auth provider', description: 'Connect authentication to enable this action.', tone: 'info' }) },
          ]}
        />
      </div>
    </header>
  )
}
