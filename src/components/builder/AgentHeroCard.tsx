import { FlaskConical, Pencil, Rocket } from 'lucide-react'
import { useWorkspace } from '@/state/workspace'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { AvatarPreview } from '@/components/avatar/AvatarPreview'
import { ChannelPills } from '@/components/agents/channels'
import type { BuilderConfig } from './templates'
import { STAGES, type BuildState } from './useBuilder'

const BUILDING_COPY = ['Understanding the job', 'Planning the conversation', 'Choosing knowledge', 'Pairing the avatar', 'Connecting tools', 'Preparing deployment']

/** Top of the configuration pane: morphs from "assembling" into "Your agent is ready." */
export function AgentHeroCard({
  cfg,
  state,
  stage,
  onRename,
  onTest,
  onDeploy,
  busy,
}: {
  cfg: BuilderConfig
  state: BuildState
  stage: number
  onRename: (name: string) => void
  onTest: () => void
  onDeploy: () => void
  busy: 'test' | 'deploy' | null
}) {
  const { avatarById } = useWorkspace()
  const avatar = avatarById(cfg.avatarId)
  const ready = state === 'done'

  return (
    <section
      aria-labelledby="agent-hero-title"
      className={cn(
        'relative isolate overflow-hidden rounded-panel border bg-surface p-5 transition-[border-color,box-shadow] duration-700 sm:p-6',
        ready ? 'border-accent/25 shadow-[0_40px_120px_-50px_rgb(143_124_255/0.55)]' : 'border-line',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 -z-10 size-[360px] rounded-full opacity-70 blur-3xl"
        style={{ background: `radial-gradient(closest-side, hsl(${avatar?.hue ?? 258} 80% 60% / ${ready ? 0.22 : 0.1}), transparent)` }}
      />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch sm:gap-6">
        <AvatarPreview
          avatar={avatar}
          alive
          scanning={!ready}
          framing="portrait"
          rounded="rounded-[18px]"
          className={cn('aspect-[16/11] w-full shrink-0 transition-all duration-700 sm:aspect-[4/5] sm:w-[200px]')}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className={cn('text-[12px] font-medium uppercase tracking-[0.14em]', ready ? 'text-success' : 'text-fg-subtle')} aria-live="polite">
            {ready ? 'Your agent is ready.' : `${BUILDING_COPY[Math.max(0, Math.min(stage, STAGES.length - 1))]}…`}
          </p>

          <div className="group relative mt-2">
            <label htmlFor="agent-name" className="sr-only">
              Agent name
            </label>
            <input
              id="agent-name"
              value={cfg.name}
              onChange={(e) => onRename(e.target.value)}
              maxLength={60}
              className="w-full rounded-[10px] border border-transparent bg-transparent py-1 pr-8 font-display text-[26px] font-semibold leading-tight tracking-[-0.025em] text-fg transition-colors hover:border-line focus:border-accent/50 focus:bg-white/[0.03] focus:px-2 focus:outline-none sm:text-[30px]"
            />
            <Pencil aria-hidden className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-fg-subtle opacity-60 group-focus-within:opacity-0" />
          </div>
          <h2 id="agent-hero-title" className="sr-only">
            {cfg.name}
          </h2>

          <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-fg-muted">{cfg.purpose}</p>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-fg-subtle">
            <span>
              Powered by <span className="text-fg">{avatar?.name ?? '—'}</span>
            </span>
            <span>{cfg.languages.join(' · ')}</span>
            <span>{cfg.tools.filter((t) => t.enabled).length} tools</span>
          </div>
          {ready && <ChannelPills channels={cfg.channels} className="mt-3 animate-fade-in" />}

          <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row">
            <Button
              variant="secondary"
              size="lg"
              leftIcon={<FlaskConical aria-hidden />}
              disabled={!ready || busy !== null}
              loading={busy === 'test'}
              onClick={onTest}
              className="sm:flex-1"
            >
              Test Agent
            </Button>
            <Button
              variant="accent"
              size="lg"
              leftIcon={<Rocket aria-hidden />}
              disabled={!ready || busy !== null}
              loading={busy === 'deploy'}
              onClick={onDeploy}
              className="sm:flex-1"
            >
              Deploy Agent
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
