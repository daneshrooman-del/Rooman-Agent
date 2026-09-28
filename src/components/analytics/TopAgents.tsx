import { Link } from 'react-router-dom'
import { formatNumber } from '@/lib/format'
import type { Agent, Avatar } from '@/types'
import { Card, StatusDot } from '@/components/ui'
import { AvatarChip } from '@/components/avatar/AvatarPreview'

/** Horizontal bar chart of agents ranked by conversations, with completion rate as text. */
export function TopAgents({ agents, avatarById }: { agents: Agent[]; avatarById: (id: string) => Avatar | undefined }) {
  const ranked = [...agents].sort((a, b) => b.stats.conversations - a.stats.conversations)
  const max = Math.max(1, ...ranked.map((a) => a.stats.conversations))
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-6">
        <h2 className="text-[17px] font-semibold">Top agents</h2>
        <p className="mt-0.5 text-[13px] text-fg-muted">By conversations handled · all time</p>
      </div>
      <ol className="flex flex-col gap-4">
        {ranked.map((a) => {
          const avatar = avatarById(a.avatarId)
          const pct = (a.stats.conversations / max) * 100
          return (
            <li key={a.id}>
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <StatusDot status={a.status} />
                  <Link to={`/agents/${a.id}`} className="truncate text-[14px] font-medium hover:underline">
                    {a.name}
                  </Link>
                  {avatar && (
                    <span className="hidden shrink-0 items-center gap-1 text-[12px] text-fg-subtle sm:inline-flex">
                      <AvatarChip avatar={avatar} size={16} />
                      {avatar.name}
                    </span>
                  )}
                </div>
                <span className="tabular shrink-0 text-[14px] font-medium">{formatNumber(a.stats.conversations)}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(pct, a.stats.conversations ? 1 : 0)}%` }} />
                </div>
                <span className="tabular w-28 shrink-0 text-right text-[12px] text-fg-subtle">
                  {a.stats.conversations ? `${a.stats.completionRate}% completed` : 'Not deployed'}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
