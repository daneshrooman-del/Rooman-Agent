import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bot, Clapperboard, Radio, ShieldCheck, UserRound, UserRoundPlus } from 'lucide-react'
import type { Avatar } from '@/types'
import { ButtonLink } from '@/components/ui/Button'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { AvatarPreview } from '@/components/avatar/AvatarPreview'

const flow = [
  { label: 'Avatar', icon: UserRound, to: '/avatars' },
  { label: 'Video', icon: Clapperboard, to: '/create' },
  { label: 'Live AI', icon: Radio, to: '/live' },
  { label: 'Agents', icon: Bot, to: '/agents' },
]

const captions = (name: string) => [`Hi, I’m ${name}’s digital twin.`, 'I can present, converse and work as an agent.', 'Same face. Same voice. Everywhere.']

/** Gently alternate speaking / idle so the hero avatar feels present. */
function useAmbientSpeech(count: number) {
  const [i, setI] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let t: number
    const cycle = (on: boolean) => {
      setSpeaking(on)
      if (!on) setI((x) => (x + 1) % count)
      t = window.setTimeout(() => cycle(!on), on ? 3200 : 1800)
    }
    t = window.setTimeout(() => cycle(true), 1200)
    return () => window.clearTimeout(t)
  }, [count])
  return { speaking, index: i }
}

export function HomeHero({ avatar }: { avatar: Avatar | undefined }) {
  const name = avatar?.name ?? 'your avatar'
  const lines = captions(name)
  const { speaking, index } = useAmbientSpeech(lines.length)
  const line = lines[index]

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden rounded-hero border border-line bg-surface">
      {/* atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 size-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(122_99_255/0.22),transparent)] blur-2xl" />
        <div className="absolute -bottom-40 right-1/3 size-[420px] rounded-full bg-[radial-gradient(closest-side,rgb(91_141_255/0.14),transparent)] blur-2xl" />
        <div className="absolute inset-0 grid-lines opacity-30 [mask-image:radial-gradient(70%_80%_at_20%_40%,black,transparent)]" />
      </div>

      <div className="relative grid lg:grid-cols-[1.15fr_1fr]">
        {/* copy */}
        <div className="flex flex-col justify-center px-6 pb-8 pt-10 sm:px-10 sm:pt-14 lg:py-16 lg:pl-14 lg:pr-6">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-line-strong bg-white/[0.03] px-3 py-1 text-[12px] text-fg-muted">
            <span className="size-1.5 rounded-full bg-gradient-to-r from-accent to-accent-2" aria-hidden />
            One identity · every experience
          </p>
          <h1 id="hero-title" className="mt-6 text-[40px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[56px] xl:text-[64px]">
            <span className="text-gradient">Bring your AI human to life.</span>
          </h1>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-fg-muted sm:text-[17px]">
            Create one digital identity and use it across videos, live conversations, and autonomous AI agents.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink to="/avatars/new" variant="primary" size="lg" leftIcon={<UserRoundPlus />}>
              Create Avatar
            </ButtonLink>
            <ButtonLink to={avatar ? `/create?avatar=${avatar.id}` : '/create'} size="lg" leftIcon={<Clapperboard />}>
              Create Video
            </ButtonLink>
            <ButtonLink to={avatar ? `/live?avatar=${avatar.id}` : '/live'} size="lg" variant="ghost" leftIcon={<Radio />}>
              Launch Live AI
            </ButtonLink>
          </div>

          {/* identity flow */}
          <nav aria-label="How Persona works" className="mt-10 hidden sm:block">
            <ol className="flex items-center gap-1.5">
              {flow.map((f, i) => (
                <li key={f.label} className="flex items-center gap-1.5">
                  <Link to={f.to} className="group flex h-8 items-center gap-2 rounded-full border border-line bg-white/[0.02] px-3 text-[12px] text-fg-muted transition-colors hover:border-line-strong hover:text-fg">
                    <f.icon className="size-3.5 text-fg-subtle group-hover:text-fg" aria-hidden />
                    {f.label}
                  </Link>
                  {i < flow.length - 1 && <ArrowRight className="size-3 text-fg-subtle/70" aria-hidden />}
                </li>
              ))}
            </ol>
          </nav>
        </div>

        {/* cinematic avatar stage */}
        <div className="relative px-4 pb-4 sm:px-6 sm:pb-6 lg:py-6 lg:pl-0 lg:pr-6">
          <AvatarPreview avatar={avatar} speaking={speaking} speakingIndicator={false} framing="portrait" rounded="rounded-[22px]" className="aspect-[4/4.2] w-full border border-white/[0.06] sm:aspect-[4/3.4] lg:aspect-auto lg:h-full lg:min-h-[480px]">
            <div className="absolute inset-x-4 top-4 flex items-center justify-between">
              <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5">
                <span className="text-[13px] font-medium">{name}</span>
                <span className="text-[12px] text-fg-subtle">{avatar?.kind}</span>
              </div>
              {avatar && <StatusIndicator status={avatar.status === 'ready' ? 'online' : 'training'} label={avatar.status === 'ready' ? 'Ready' : 'Training'} className="bg-black/40 backdrop-blur-md" />}
            </div>

            {/* live caption */}
            <div className="absolute inset-x-4 bottom-4 sm:inset-x-6 sm:bottom-6">
              <div className="glass-strong mx-auto flex max-w-sm items-center gap-3 rounded-[16px] px-4 py-3" aria-live="off">
                <span className="flex h-5 items-end gap-[2px]" aria-hidden>
                  {[0, 1, 2, 3].map((b) => (
                    <span key={b} className={speaking ? 'h-full w-[3px] origin-bottom animate-wave rounded-full bg-accent' : 'h-1.5 w-[3px] rounded-full bg-fg-subtle'} style={{ animationDelay: `${b * 0.14}s` }} />
                  ))}
                </span>
                <p key={line} className="animate-fade-in text-[13px] text-fg">
                  {line}
                </p>
              </div>
              {avatar && (
                <div className="mt-3 hidden items-center justify-center gap-2 text-[11px] text-fg-muted sm:flex">
                  <ShieldCheck className="size-3.5 text-success" aria-hidden />
                  Identity verified · used in {avatar.usage.videos} videos, {avatar.usage.agents} agents, {avatar.usage.liveSessions} live sessions
                </div>
              )}
            </div>
          </AvatarPreview>
        </div>
      </div>
    </section>
  )
}
