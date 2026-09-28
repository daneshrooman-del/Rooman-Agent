import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Headset, MessageSquare, PencilLine, Rocket, UserRound } from 'lucide-react'
import type { Agent, Avatar } from '@/types'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useWorkspace } from '@/state/workspace'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { AvatarPreview } from '@/components/avatar/AvatarPreview'
import { ChannelPills } from '../channels'
import { FileTypeIcon } from '@/components/knowledge/fileTypes'

const activityIcon = { conversation: MessageSquare, deploy: Rocket, edit: PencilLine, handoff: Headset }

function Section({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('border-t border-line pt-6 first:border-t-0 first:pt-0', className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

const tabLink = 'inline-flex items-center gap-1 text-[12px] font-medium text-fg-muted transition-colors hover:text-fg'

export function OverviewTab({ agent, avatar, tabHref }: { agent: Agent; avatar: Avatar | undefined; tabHref: (t: string) => string }) {
  const { voiceName } = useWorkspace()
  const ready = agent.knowledge.filter((k) => k.status === 'ready')
  const chunks = agent.knowledge.reduce((s, k) => s + k.chunks, 0)

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
      <div className="flex flex-col gap-8">
        <Section title="Purpose">
          <p className="max-w-2xl text-[20px] font-medium leading-snug tracking-[-0.01em] text-fg sm:text-[22px]">{agent.purpose}</p>
          <p className="mt-3 flex items-center gap-2 text-[13px] text-fg-muted">
            <UserRound className="size-4 text-fg-subtle" aria-hidden />
            <span className="text-fg-subtle">Speaks with</span> {agent.caller}
          </p>
        </Section>

        <Section title="Goals">
          <ol className="flex flex-col gap-2.5">
            {agent.goals.map((g, i) => (
              <li key={g} className="flex items-start gap-3 text-[15px] text-fg">
                <span className="tabular mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-[11px] text-fg-muted">{i + 1}</span>
                {g}
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Recent activity">
          {agent.activity.length === 0 ? (
            <p className="text-[14px] text-fg-muted">No activity yet. Test the agent to see it here.</p>
          ) : (
            <ol className="relative flex flex-col">
              {agent.activity.map((a, i) => {
                const Icon = activityIcon[a.kind]
                const last = i === agent.activity.length - 1
                return (
                  <li key={a.id} className="relative flex gap-4 pb-5 last:pb-0">
                    {!last && <span aria-hidden className="absolute left-[15px] top-8 bottom-0 w-px bg-line-strong" />}
                    <span
                      className={cn(
                        'relative flex size-8 shrink-0 items-center justify-center rounded-full border bg-surface-2',
                        a.kind === 'handoff' ? 'border-[#ff7a8e]/30 text-[#ff9aab]' : a.kind === 'deploy' ? 'border-success/30 text-success' : 'border-line-strong text-fg-muted',
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <div className="min-w-0 pt-1">
                      <p className="text-[14px] text-fg">{a.text}</p>
                      <p className="mt-0.5 text-[12px] text-fg-subtle">
                        <time dateTime={a.at}>{timeAgo(a.at)}</time>
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </Section>
      </div>

      <aside className="flex flex-col gap-8" aria-label="Agent identity and setup">
        <div className="surface overflow-hidden rounded-panel">
          <AvatarPreview avatar={avatar} framing="portrait" rounded="rounded-none" className="aspect-[4/3] w-full">
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/60">Current avatar</p>
                <p className="truncate text-[17px] font-semibold text-white">{avatar?.name ?? 'Unassigned'}</p>
              </div>
              {avatar && <StatusIndicator status={avatar.status === 'ready' ? 'ready' : 'training'} />}
            </div>
          </AvatarPreview>
          <dl className="divide-y divide-line text-[13px]">
            <div className="flex items-center justify-between gap-3 px-5 py-3.5">
              <dt className="text-fg-subtle">Voice</dt>
              <dd className="truncate text-fg">{voiceName(agent.voiceId)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3.5">
              <dt className="text-fg-subtle">Languages</dt>
              <dd className="truncate text-fg">{agent.languages.join(', ')}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3.5">
              <dt className="text-fg-subtle">Personality</dt>
              <dd className="max-w-[60%] truncate text-right text-fg" title={agent.personality}>
                {agent.personality}
              </dd>
            </div>
          </dl>
          <div className="border-t border-line px-5 py-3">
            <Link to={tabHref('avatar')} className={tabLink}>
              Manage identity <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>

        <Section title="Channels">
          {agent.channels.length ? <ChannelPills channels={agent.channels} /> : <p className="text-[14px] text-fg-muted">Not deployed to any channel.</p>}
        </Section>

        <Section
          title="Knowledge"
          action={
            <Link to={tabHref('knowledge')} className={tabLink}>
              Manage <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        >
          {agent.knowledge.length === 0 ? (
            <p className="flex items-center gap-2 text-[14px] text-fg-muted">
              <BookOpen className="size-4 text-fg-subtle" aria-hidden /> No knowledge connected yet.
            </p>
          ) : (
            <>
              <p className="text-[14px] text-fg-muted">
                <span className="tabular font-semibold text-fg">{agent.knowledge.length}</span> sources · <span className="tabular">{ready.length}</span> ready ·{' '}
                <span className="tabular">{chunks}</span> chunks indexed
              </p>
              <ul className="mt-3 flex flex-col gap-1">
                {agent.knowledge.slice(0, 4).map((k) => (
                  <li key={k.id} className="flex items-center gap-3 rounded-[10px] py-1.5 text-[13px]">
                    <FileTypeIcon type={k.type} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-fg">{k.name}</span>
                    {k.status !== 'ready' && <StatusIndicator status={k.status} variant="inline" />}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      </aside>
    </div>
  )
}
