import { Link } from 'react-router-dom'
import { ArrowUpRight, Bot, Clapperboard, Radio } from 'lucide-react'
import type { WorkspaceSnapshot } from '@/lib/api'
import type { Avatar } from '@/types'
import { formatNumber } from '@/lib/format'
import { AvatarChip } from '@/components/avatar/AvatarPreview'
import { StatusIndicator } from '@/components/ui/StatusIndicator'

function Tile({ to, label, children, footer }: { to: string; label: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="group relative flex flex-col justify-between gap-6 rounded-card border border-line bg-surface p-5 shadow-soft transition-[border-color,transform] duration-300 ease-out-soft hover:-translate-y-0.5 hover:border-line-strong"
    >
      <div className="flex items-center justify-between text-[13px] text-fg-muted">
        {label}
        <ArrowUpRight className="size-4 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </div>
      <div>{children}</div>
      <div className="text-[12px] text-fg-subtle">{footer}</div>
    </Link>
  )
}

export function WorkspaceStats({ data, avatar }: { data: WorkspaceSnapshot; avatar: Avatar | undefined }) {
  const readyVideos = data.videos.filter((v) => v.status === 'ready').length
  const generating = data.videos.filter((v) => v.status === 'generating').length
  const liveTotal = data.avatars.reduce((s, a) => s + a.usage.liveSessions, 0)
  const liveAgents = data.agents.filter((a) => a.status === 'live')
  const conversationsToday = data.agents.reduce((s, a) => s + a.stats.activeToday, 0)

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <Tile to={avatar ? `/avatars/${avatar.id}` : '/avatars'} label="Active avatar" footer={`${data.avatars.length} avatars in workspace`}>
        <div className="flex items-center gap-3">
          <AvatarChip avatar={avatar} size={40} />
          <div className="min-w-0">
            <p className="truncate text-[20px] font-semibold leading-tight">{avatar?.name ?? '—'}</p>
            {avatar && <StatusIndicator status={avatar.status === 'ready' ? 'ready' : 'training'} variant="inline" className="text-[12px]" />}
          </div>
        </div>
      </Tile>
      <Tile to="/videos" label="Videos generated" footer={generating ? `${generating} generating now` : 'All renders complete'}>
        <p className="tabular flex items-baseline gap-2 text-[32px] font-semibold leading-none tracking-tight">
          {formatNumber(readyVideos)}
          <Clapperboard className="size-4 text-fg-subtle" aria-hidden />
        </p>
      </Tile>
      <Tile to="/live" label="Live conversations" footer="Across all avatars">
        <p className="tabular flex items-baseline gap-2 text-[32px] font-semibold leading-none tracking-tight">
          {formatNumber(liveTotal)}
          <Radio className="size-4 text-fg-subtle" aria-hidden />
        </p>
      </Tile>
      <Tile to="/agents" label="Active agents" footer={`${conversationsToday} conversations today`}>
        <p className="tabular flex items-baseline gap-2 text-[32px] font-semibold leading-none tracking-tight">
          {liveAgents.length}
          <span className="text-[15px] font-normal text-fg-subtle">/ {data.agents.length}</span>
          <Bot className="size-4 text-fg-subtle" aria-hidden />
        </p>
      </Tile>
    </div>
  )
}
