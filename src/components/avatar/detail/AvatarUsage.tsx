import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bot, ChevronRight, Clapperboard, MessageSquare, Radio } from 'lucide-react'
import type { Avatar } from '@/types'
import { formatDuration, formatNumber, timeAgo } from '@/lib/format'
import { useWorkspace } from '@/state/workspace'
import { SectionHeader } from '@/components/ui/PageHeader'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { VideoThumb } from '@/components/video/VideoThumb'

function UsageBlock({
  icon,
  label,
  layer,
  count,
  href,
  hrefLabel,
  children,
  delay,
}: {
  icon: ReactNode
  label: string
  layer: string
  count: number
  href: string
  hrefLabel: string
  children: ReactNode
  delay: number
}) {
  return (
    <article className="flex min-w-0 flex-col rounded-panel border border-line bg-surface p-5 shadow-soft animate-fade-up sm:p-6" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-[12px] border border-line-strong bg-white/[0.04] [&_svg]:size-[18px]">{icon}</span>
          <div>
            <h3 className="text-[15px] font-semibold">{label}</h3>
            <p className="text-[12px] text-fg-subtle">{layer} layer</p>
          </div>
        </div>
        <span className="tabular text-[34px] font-semibold leading-none tracking-[-0.03em]">{formatNumber(count)}</span>
      </div>
      <div className="mt-5 flex-1">{children}</div>
      <Link to={href} className="mt-5 inline-flex items-center gap-1 self-start text-[13px] font-medium text-fg-muted transition-colors hover:text-fg">
        {hrefLabel} <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </article>
  )
}

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="rounded-[12px] border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-fg-subtle">{children}</p>
)

/** "This avatar is used by" — the avatar's footprint across video, live and agents. */
export function AvatarUsage({ avatar }: { avatar: Avatar }) {
  const { data } = useWorkspace()
  if (!data) return null
  const videos = data.videos.filter((v) => v.avatarId === avatar.id)
  const sessions = data.liveSessions.filter((s) => s.avatarId === avatar.id)
  const agents = data.agents.filter((a) => a.avatarId === avatar.id)
  const training = avatar.status !== 'ready'
  const u = avatar.usage

  return (
    <section aria-labelledby="usage-heading">
      <SectionHeader
        title={<span id="usage-heading">This avatar is used by</span>}
        description={`${avatar.name} — ${formatNumber(u.videos)} Videos · ${formatNumber(u.agents)} Agents · ${formatNumber(u.liveSessions)} Live Sessions`}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-5">
        <UsageBlock icon={<Clapperboard aria-hidden />} label="Videos" layer="Content" count={u.videos} href="/videos" hrefLabel="All videos" delay={60}>
          {videos.length ? (
            <ul className="grid grid-cols-2 gap-x-2.5 gap-y-3">
              {videos.slice(0, 4).map((v) => (
                <li key={v.id} className="min-w-0">
                  <Link to="/videos" className="group block" aria-label={`${v.title}, ${formatDuration(v.durationSec)}`}>
                    <VideoThumb video={v} avatar={avatar} showMeta={false} className="rounded-[10px] border border-line transition-[border-color] group-hover:border-line-strong" />
                    <p className="mt-1.5 truncate text-[12px] text-fg-muted group-hover:text-fg">{v.title}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{training ? 'Available once training completes.' : 'No videos yet — generate the first one.'}</Empty>
          )}
        </UsageBlock>

        <UsageBlock icon={<Radio aria-hidden />} label="Live AI" layer="Interaction" count={u.liveSessions} href={`/live?avatar=${avatar.id}`} hrefLabel="Start a live session" delay={120}>
          {sessions.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {sessions.slice(0, 3).map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-live/10">
                    <MessageSquare className="size-3.5 text-[#ff8e9c]" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{s.title}</p>
                    <p className="tabular text-[12px] text-fg-subtle">
                      {formatDuration(s.durationSec)} · {s.messages} messages · {timeAgo(s.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{training ? 'Available once training completes.' : 'No live sessions yet.'}</Empty>
          )}
        </UsageBlock>

        <UsageBlock icon={<Bot aria-hidden />} label="Agents" layer="Orchestration" count={u.agents} href="/agents" hrefLabel="All agents" delay={180}>
          {agents.length ? (
            <ul className="flex flex-col gap-1.5">
              {agents.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <Link to={`/agents/${a.id}`} className="group flex items-center gap-3 rounded-[12px] border border-line bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-line-strong hover:bg-white/[0.04]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{a.name}</p>
                      <p className="tabular text-[12px] text-fg-subtle">{formatNumber(a.stats.conversations)} conversations</p>
                    </div>
                    <StatusIndicator status={a.status} variant="inline" />
                    <ChevronRight className="size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{training ? 'Available once training completes.' : 'Not powering any agents yet.'}</Empty>
          )}
        </UsageBlock>
      </div>
    </section>
  )
}
