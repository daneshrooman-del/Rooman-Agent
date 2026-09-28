import { Link } from 'react-router-dom'
import { ChevronLeft, Pause, Pencil, Play, Radio, Rocket } from 'lucide-react'
import type { Agent, Avatar } from '@/types'
import { timeAgo } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { AvatarChip, AvatarPreview } from '@/components/avatar/AvatarPreview'

export function AgentHeader({
  agent,
  avatar,
  onTest,
  onTogglePause,
  onEdit,
  onDeploy,
}: {
  agent: Agent
  avatar: Avatar | undefined
  onTest: () => void
  onTogglePause: () => void
  onEdit: () => void
  onDeploy: () => void
}) {
  const paused = agent.status === 'paused'
  const deploying = agent.status === 'deploying'
  const canPause = agent.status === 'live' || paused
  return (
    <header className="animate-fade-up">
      <Link to="/agents" className="inline-flex h-8 items-center gap-1 rounded-[8px] pr-2 text-[13px] text-fg-subtle transition-colors hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden />
        My Agents
      </Link>
      <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <AvatarPreview avatar={avatar} framing="close" rounded="rounded-[18px]" className="size-16 shrink-0 border border-line-strong sm:size-[76px]" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-[26px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[34px]">{agent.name}</h1>
              <StatusIndicator status={agent.status} />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-fg-subtle">
              {avatar ? (
                <Link
                  to={`/avatars/${avatar.id}`}
                  className="inline-flex h-7 items-center gap-2 rounded-full border border-line bg-white/[0.03] py-0.5 pl-0.5 pr-3 transition-colors hover:border-line-strong hover:bg-white/[0.06]"
                >
                  <AvatarChip avatar={avatar} size={24} />
                  <span className="text-fg-muted">
                    Powered by <span className="font-medium text-fg">{avatar.name}</span>
                  </span>
                </Link>
              ) : (
                <span>No avatar assigned</span>
              )}
              <span>Updated {timeAgo(agent.updatedAt)}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Button variant="secondary" size="md" leftIcon={<Radio />} onClick={onTest} className="px-3 sm:px-4">
            Test
          </Button>
          <Button variant="ghost" leftIcon={paused ? <Play /> : <Pause />} onClick={onTogglePause} disabled={!canPause} className="px-3 sm:px-4">
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="ghost" leftIcon={<Pencil />} onClick={onEdit} className="px-3 sm:px-4">
            Edit
          </Button>
          <Button variant="accent" leftIcon={<Rocket />} onClick={onDeploy} loading={deploying} className="px-3 sm:px-4">
            {deploying ? 'Deploying' : 'Deploy'}
          </Button>
        </div>
      </div>
    </header>
  )
}
