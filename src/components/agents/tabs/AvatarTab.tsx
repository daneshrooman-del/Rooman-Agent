import { Bot, Clapperboard, Radio, Sparkles, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Agent } from '@/types'
import { useWorkspace } from '@/state/workspace'
import { ButtonLink } from '@/components/ui/Button'
import { AvatarPicker } from '@/components/avatar/AvatarPicker'
import { AvatarPreview } from '@/components/avatar/AvatarPreview'
import { useAgentActions } from '../useAgentActions'

export function AvatarTab({ agent }: { agent: Agent }) {
  const { avatarById, voiceName, data } = useWorkspace()
  const { save, logActivity } = useAgentActions(agent)
  const avatar = avatarById(agent.avatarId)
  const agentsUsing = (data?.agents ?? []).filter((a) => a.avatarId === agent.avatarId).length

  const experiences: { icon: LucideIcon; label: string; value: string; to: string; cta: string }[] = avatar
    ? [
        { icon: Clapperboard, label: 'Videos', value: `${avatar.usage.videos}`, to: `/create?avatar=${avatar.id}`, cta: 'Create video' },
        { icon: Radio, label: 'Live sessions', value: `${avatar.usage.liveSessions}`, to: `/live?avatar=${avatar.id}&agent=${agent.id}`, cta: 'Go live' },
        { icon: Bot, label: 'Agents', value: `${agentsUsing}`, to: '/agents', cta: 'View workforce' },
      ]
    : []

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
      <AvatarPreview avatar={avatar} framing="stage" rounded="rounded-hero" className="aspect-[4/3] w-full border border-line lg:aspect-[5/4]">
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-6 pt-20 sm:p-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/60">{avatar?.kind ?? 'Avatar'}</p>
          <p className="mt-1 text-[30px] font-semibold leading-none tracking-[-0.02em] text-white sm:text-[40px]">{avatar?.name ?? 'No avatar'}</p>
          <p className="mt-2 text-[13px] text-white/70">
            {voiceName(agent.voiceId)} · {avatar?.languages.join(', ')}
          </p>
        </div>
      </AvatarPreview>

      <div className="flex flex-col gap-8">
        <div>
          <p className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-accent">
            <Sparkles className="size-3.5" aria-hidden /> One identity
          </p>
          <h2 className="mt-3 text-[24px] font-semibold leading-tight tracking-[-0.02em] sm:text-[28px]">
            The same face and voice, <span className="text-gradient">everywhere this agent works.</span>
          </h2>
          <p className="mt-3 text-[14px] text-fg-muted">
            {agent.name} speaks as {avatar?.name ?? 'its avatar'} on every channel — the same identity used in your videos and live sessions.
          </p>
        </div>

        <div className="max-w-sm">
          <AvatarPicker
            label="Powering avatar"
            value={agent.avatarId}
            onChange={(id) => {
              const next = avatarById(id)
              if (!next || id === agent.avatarId) return
              save(
                { avatarId: id, voiceId: next.voiceId, activity: logActivity(`Avatar switched to ${next.name}`, 'edit') },
                { title: `Now powered by ${next.name}`, description: `Voice switched to ${voiceName(next.voiceId)}.` },
              )
            }}
          />
        </div>

        {avatar && (
          <ul className="grid grid-cols-1 divide-y divide-line rounded-panel border border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {experiences.map((e) => (
              <li key={e.label} className="flex items-center justify-between gap-3 p-4 sm:flex-col sm:items-start">
                <div className="flex items-center gap-3 sm:block">
                  <e.icon className="size-4 text-fg-subtle" aria-hidden />
                  <p className="text-[12px] text-fg-subtle sm:mt-3">{e.label}</p>
                  <p className="tabular text-[20px] font-semibold sm:mt-0.5">{e.value}</p>
                </div>
                <Link to={e.to} className="text-[13px] font-medium text-fg-muted transition-colors hover:text-fg">
                  {e.cta} →
                </Link>
              </li>
            ))}
          </ul>
        )}

        {avatar && (
          <div className="flex flex-wrap gap-2">
            <ButtonLink to={`/create?avatar=${avatar.id}`} variant="secondary" leftIcon={<Clapperboard />}>
              Create video with {avatar.name}
            </ButtonLink>
            <ButtonLink to={`/live?avatar=${avatar.id}&agent=${agent.id}`} variant="ghost" leftIcon={<Radio />}>
              Go live with {avatar.name}
            </ButtonLink>
          </div>
        )}
      </div>
    </div>
  )
}
