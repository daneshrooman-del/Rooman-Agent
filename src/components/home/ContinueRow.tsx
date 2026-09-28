import { Link } from 'react-router-dom'
import { Bot, Radio } from 'lucide-react'
import type { WorkspaceSnapshot } from '@/lib/api'
import { formatDuration, timeAgo } from '@/lib/format'
import { useWorkspace } from '@/state/workspace'
import { AvatarPreview, AvatarChip } from '@/components/avatar/AvatarPreview'
import { VideoThumb } from '@/components/video/VideoThumb'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { ProgressBar } from '@/components/ui/States'

interface Item {
  id: string
  at: string
  to: string
  kind: string
  title: string
  meta: string
  visual: React.ReactNode
  status?: React.ReactNode
}

/** Mixed "recent work" feed across all four layers. */
export function ContinueRow({ data }: { data: WorkspaceSnapshot }) {
  const { avatarById } = useWorkspace()
  const items: Item[] = []

  const video = [...data.videos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).find((v) => v.status !== 'failed')
  if (video) {
    const av = avatarById(video.avatarId)
    items.push({
      id: video.id,
      at: video.createdAt,
      to: video.status === 'ready' ? `/videos?v=${video.id}` : '/videos',
      kind: 'Video',
      title: video.title,
      meta: `${av?.name ?? ''} · ${video.status === 'ready' ? formatDuration(video.durationSec) : `${video.progress ?? 0}% rendered`}`,
      visual: <VideoThumb video={video} avatar={av} showMeta={false} className="h-full" />,
      status: video.status !== 'ready' && <StatusIndicator status={video.status} />,
    })
  }

  const training = data.avatars.find((a) => a.status === 'training')
  if (training) {
    items.push({
      id: training.id,
      at: training.createdAt,
      to: `/avatars/${training.id}`,
      kind: 'Avatar training',
      title: training.name,
      meta: `Learning facial motion · ${training.trainingProgress ?? 0}%`,
      visual: (
        <AvatarPreview avatar={training} scanning rounded="rounded-none" className="h-full">
          <div className="absolute inset-x-4 bottom-4">
            <ProgressBar value={training.trainingProgress ?? 0} label={`${training.name} training`} />
          </div>
        </AvatarPreview>
      ),
      status: <StatusIndicator status="training" />,
    })
  }

  const agent = [...data.agents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  if (agent) {
    const av = avatarById(agent.avatarId)
    items.push({
      id: agent.id,
      at: agent.updatedAt,
      to: `/agents/${agent.id}`,
      kind: 'Agent',
      title: agent.name,
      meta: `Powered by ${av?.name ?? '—'} · updated ${timeAgo(agent.updatedAt)}`,
      visual: (
        <div className="relative flex h-full items-center justify-center bg-[radial-gradient(70%_70%_at_50%_30%,rgb(143_124_255/0.18),transparent)]">
          <div className="absolute inset-0 grid-lines opacity-40" />
          <div className="relative flex items-center gap-3 rounded-full border border-line-strong bg-black/40 py-1.5 pl-1.5 pr-4 backdrop-blur">
            <AvatarChip avatar={av} size={34} />
            <Bot className="size-4 text-fg-muted" aria-hidden />
            <span className="text-[13px] font-medium">{agent.workflow.length} steps</span>
          </div>
        </div>
      ),
      status: <StatusIndicator status={agent.status} />,
    })
  }

  const session = data.liveSessions[0]
  if (session) {
    const av = avatarById(session.avatarId)
    items.push({
      id: session.id,
      at: session.createdAt,
      to: `/live?avatar=${session.avatarId}`,
      kind: 'Live session',
      title: session.title,
      meta: `${formatDuration(session.durationSec)} · ${session.messages} messages`,
      visual: (
        <AvatarPreview avatar={av} alive={false} framing="close" rounded="rounded-none" className="h-full">
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-1 text-[11px] text-fg backdrop-blur">
            <Radio className="size-3" aria-hidden /> Replay
          </span>
        </AvatarPreview>
      ),
    })
  }

  return (
    <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4">
      {items.map((it, i) => (
        <li key={it.id} className="w-[78%] shrink-0 snap-start animate-fade-up sm:w-auto" style={{ animationDelay: `${i * 60}ms` }}>
          <Link to={it.to} className="group block overflow-hidden rounded-card border border-line bg-surface shadow-soft transition-[border-color,transform] duration-300 ease-out-soft hover:-translate-y-0.5 hover:border-line-strong">
            <div className="relative aspect-video overflow-hidden">
              <div className="h-full transition-transform duration-700 ease-out-soft group-hover:scale-[1.03]">{it.visual}</div>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-fg-subtle">{it.kind}</p>
                {it.status}
              </div>
              <p className="mt-2 truncate text-[15px] font-medium">{it.title}</p>
              <p className="mt-0.5 truncate text-[12px] text-fg-subtle">{it.meta}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
