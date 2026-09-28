import { Link, NavLink } from 'react-router-dom'
import { HelpCircle, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useWorkspace } from '@/state/workspace'
import { libraryNav, primaryNav, settingsNav, type NavItem } from '@/components/navigation/nav'
import { Logo } from '@/components/navigation/Logo'
import { AvatarChip } from '@/components/avatar/AvatarPreview'
import { StatusDot } from '@/components/ui/StatusIndicator'
import { CreateMenu } from './CreateMenu'

function Item({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex h-10 items-center gap-3 rounded-[10px] text-[14px] font-medium transition-colors duration-200',
          collapsed ? 'justify-center px-0' : 'px-3',
          isActive ? 'bg-white/[0.07] text-fg' : 'text-fg-muted hover:bg-white/[0.04] hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span aria-hidden className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-accent to-accent-2" />}
          <Icon className={cn('size-[18px] shrink-0 transition-colors', isActive ? 'text-fg' : 'text-fg-subtle group-hover:text-fg-muted')} aria-hidden />
          <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

export function Sidebar({ collapsed, onToggle, onHelp }: { collapsed: boolean; onToggle: () => void; onHelp: () => void }) {
  const { data, primaryAvatar } = useWorkspace()
  const user = data?.user

  return (
    <aside
      aria-label="Primary"
      className={cn(
        'sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-line bg-canvas/80 px-3 pb-3 pt-4 backdrop-blur-xl transition-[width] duration-300 ease-out-soft lg:flex',
        collapsed ? 'w-[72px]' : 'w-[248px]',
      )}
    >
      <div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-between pl-1.5')}>
        <Link to="/" aria-label="Persona home" className="rounded-[10px]">
          <Logo collapsed={collapsed} />
        </Link>
        {!collapsed && (
          <button type="button" onClick={onToggle} aria-label="Collapse sidebar" className="flex size-8 items-center justify-center rounded-[8px] text-fg-subtle hover:bg-white/[0.06] hover:text-fg">
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      <div className="mt-6">
        <CreateMenu
          align="start"
          className="w-full"
          trigger={(p) => (
            <button
              type="button"
              {...p}
              title={collapsed ? 'Create' : undefined}
              className={cn(
                'flex h-10 w-full items-center gap-2 rounded-[10px] bg-fg text-[14px] font-medium text-canvas transition-all duration-200 hover:bg-white active:scale-[0.98]',
                collapsed ? 'justify-center' : 'px-3',
              )}
            >
              <Plus className="size-[18px]" aria-hidden />
              <span className={cn(collapsed && 'sr-only')}>Create</span>
            </button>
          )}
        />
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden no-scrollbar" aria-label="Main">
        <div className="flex flex-col gap-0.5">
          {primaryNav.map((i) => (
            <Item key={i.to} item={i} collapsed={collapsed} />
          ))}
        </div>
        <div className="flex flex-col gap-0.5">
          {!collapsed && <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-fg-subtle">Library</p>}
          {collapsed && <div className="mx-auto mb-2 h-px w-6 bg-line" />}
          {libraryNav.map((i) => (
            <Item key={i.to} item={i} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      {/* The identity powering everything */}
      {primaryAvatar && !collapsed && (
        <Link
          to={`/avatars/${primaryAvatar.id}`}
          className="mb-3 flex items-center gap-3 rounded-[12px] border border-line bg-white/[0.025] p-2.5 transition-colors hover:border-line-strong hover:bg-white/[0.04]"
        >
          <AvatarChip avatar={primaryAvatar} size={36} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-fg-subtle">Active identity</p>
            <p className="truncate text-[13px] font-medium">{primaryAvatar.name}</p>
          </div>
          <StatusDot status={primaryAvatar.status === 'ready' ? 'online' : 'training'} />
        </Link>
      )}

      <div className="flex flex-col gap-0.5 border-t border-line pt-3">
        <Item item={settingsNav} collapsed={collapsed} />
        <button
          type="button"
          onClick={onHelp}
          title={collapsed ? 'Help' : undefined}
          className={cn(
            'flex h-10 items-center gap-3 rounded-[10px] text-[14px] font-medium text-fg-muted transition-colors hover:bg-white/[0.04] hover:text-fg',
            collapsed ? 'justify-center' : 'px-3',
          )}
        >
          <HelpCircle className="size-[18px] text-fg-subtle" aria-hidden />
          <span className={cn(collapsed && 'sr-only')}>Help</span>
        </button>
        {user && (
          <Link
            to="/settings?section=profile"
            className={cn('mt-1 flex items-center gap-3 rounded-[10px] py-2 transition-colors hover:bg-white/[0.04]', collapsed ? 'justify-center' : 'px-2')}
            title={collapsed ? user.name : undefined}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3a3350] to-[#1d2238] text-[12px] font-semibold ring-1 ring-white/10">
              {user.name
                .split(' ')
                .map((p) => p[0])
                .join('')
                .slice(0, 2)}
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{user.name}</span>
                <span className="block truncate text-[12px] text-fg-subtle">{user.email}</span>
              </span>
            )}
          </Link>
        )}
        {collapsed && (
          <button type="button" onClick={onToggle} aria-label="Expand sidebar" className="mx-auto mt-2 flex size-8 items-center justify-center rounded-[8px] text-fg-subtle hover:bg-white/[0.06] hover:text-fg">
            <PanelLeftOpen className="size-4" />
          </button>
        )}
      </div>
    </aside>
  )
}
