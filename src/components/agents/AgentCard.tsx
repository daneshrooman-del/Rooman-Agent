import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, Pencil, Radio, Rocket } from 'lucide-react'
import type { Agent } from '@/types'
import { formatNumber } from '@/lib/format'
import { useWorkspace } from '@/state/workspace'
import { Button } from '@/components/ui/Button'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { AvatarChip } from '@/components/avatar/AvatarPreview'
import { useToast } from '@/components/ui/Toast'
import { ChannelPills } from './channels'

export function AgentCard({ agent }: { agent: Agent }) {
  const { avatarById, updateAgent } = useWorkspace()
  const navigate = useNavigate()
  const toast = useToast()
  const avatar = avatarById(agent.avatarId)
  const href = `/agents/${agent.id}`
  const hasStats = agent.stats.conversations > 0

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-panel border border-line bg-surface p-5 shadow-soft transition-[transform,border-color,box-shadow] duration-300 ease-out-soft hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_24px_60px_-24px_rgb(0_0_0/0.9),0_0_0_1px_rgb(143_124_255/0.14)] sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-70"
        style={{ background: `radial-gradient(closest-side, hsl(${avatar?.hue ?? 255} 80% 60% / 0.45), transparent)` }}
      />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <StatusIndicator status={agent.status} />
          <h3 className="mt-3 truncate text-[18px] font-semibold">
            <Link to={href} className="after:absolute after:inset-0 after:content-['']">
              {agent.name}
            </Link>
          </h3>
        </div>
        <div className="relative flex shrink-0 items-center gap-2 self-start rounded-full border border-line bg-white/[0.03] py-1 pl-1 pr-3">
          <AvatarChip avatar={avatar} size={26} />
          <span className="text-[12px] text-fg-muted">
            Powered by <span className="text-fg">{avatar?.name ?? '—'}</span>
          </span>
        </div>
      </div>

      <p className="relative mt-3 line-clamp-2 text-[14px] leading-relaxed text-fg-muted">{agent.purpose}</p>

      <ChannelPills channels={agent.channels} className="relative mt-4" />

      <dl className="relative mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
        <div>
          <dt className="text-[11px] text-fg-subtle">Conversations</dt>
          <dd className="tabular mt-0.5 text-[16px] font-semibold">{hasStats ? formatNumber(agent.stats.conversations) : '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-fg-subtle">Completion</dt>
          <dd className="tabular mt-0.5 text-[16px] font-semibold">{hasStats ? `${agent.stats.completionRate}%` : '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-fg-subtle">Active today</dt>
          <dd className="tabular mt-0.5 text-[16px] font-semibold">{hasStats ? agent.stats.activeToday : '—'}</dd>
        </div>
      </dl>

      <div className="relative z-10 mt-5 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" leftIcon={<Radio />} onClick={() => navigate(`${href}?tab=test`)}>
          Test live
        </Button>
        <Button size="sm" variant="ghost" leftIcon={<Pencil />} onClick={() => navigate(href)}>
          Edit
        </Button>
        {agent.status !== 'live' && (
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Rocket />}
            onClick={() => {
              updateAgent(agent.id, { status: 'live' })
              toast({ title: `${agent.name} deployed`, description: 'Now answering on all enabled channels.' })
            }}
          >
            Deploy
          </Button>
        )}
        <Button size="sm" variant="ghost" leftIcon={<BarChart3 />} onClick={() => navigate(`${href}?tab=analytics`)} className="ml-auto">
          Analytics
        </Button>
      </div>
    </article>
  )
}
