import { Clapperboard, Mic, Radio, Sparkles, Video, Wifi, WifiOff } from 'lucide-react'
import type { Avatar } from '@/types'
import { cn } from '@/lib/cn'
import { useWorkspace } from '@/state/workspace'
import { Button, DemoNote } from '@/components/ui'
import { AvatarChip } from '@/components/avatar/AvatarPreview'
import { LiveStage } from './LiveStage'
import { ExitButton } from './ExitButton'

/** Pre-session lobby: nothing starts until the user presses Start. */
export function LiveLobby({
  avatar,
  onAvatar,
  onStart,
  online,
  agentName,
}: {
  avatar: Avatar
  onAvatar: (id: string) => void
  onStart: () => void
  online: boolean
  agentName?: string
}) {
  const { data, isDemo } = useWorkspace()
  const ready = (data?.avatars ?? []).filter((a) => a.status === 'ready')

  const checks = [
    { icon: Mic, label: 'Microphone', value: 'Speak or type — your choice', ok: true },
    { icon: Video, label: 'Camera', value: 'Off by default · optional', ok: true },
    { icon: online ? Wifi : WifiOff, label: 'Connection', value: online ? 'Good' : 'Offline — reconnect to start', ok: online },
  ]

  return (
    <div className="flex h-dvh flex-col bg-canvas lg:grid lg:h-[calc(100dvh-64px-48px)] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-10 lg:bg-transparent">
      <div className="relative min-h-0 flex-1 lg:h-full">
        <LiveStage avatar={avatar} status="idle" phase="idle" framing="portrait" rounded="rounded-none lg:rounded-hero" className="absolute inset-0 lg:border lg:border-line" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 lg:hidden">
          <ExitButton />
          <span className="glass-strong inline-flex h-8 items-center gap-2 rounded-full px-3 text-[12px] font-medium text-fg-muted">
            <Radio className="size-3.5 text-live" aria-hidden /> Live AI
          </span>
        </div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-canvas to-transparent lg:hidden" />
      </div>

      <div className="relative shrink-0 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1 lg:flex lg:flex-col lg:justify-center lg:px-0 lg:py-8">
        <p className="hidden items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-fg-subtle lg:flex">
          <Radio className="size-3.5 text-live" aria-hidden /> Live AI
        </p>
        <h1 className="text-[30px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[40px] lg:mt-4 lg:text-[52px]">
          Talk to <span className="text-gradient">{avatar.name}</span>, live.
        </h1>
        <p className="mt-2 max-w-md text-[14px] text-fg-muted sm:text-[15px] lg:mt-4">
          {agentName
            ? `A real-time conversation with ${avatar.name}, running as ${agentName}.`
            : `A real-time, face-to-face conversation with ${avatar.name} — the same identity behind your videos and agents.`}
        </p>

        {ready.length > 1 && (
          <div role="radiogroup" aria-label="Choose avatar" className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:mt-8 lg:flex-wrap lg:px-0">
            {ready.map((a) => {
              const on = a.id === avatar.id
              return (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onAvatar(a.id)}
                  className={cn(
                    'inline-flex h-11 shrink-0 items-center gap-2.5 rounded-full border pl-1.5 pr-4 text-[13px] font-medium transition-all',
                    on ? 'border-accent/50 bg-accent/12 text-fg' : 'border-line-strong text-fg-muted hover:border-white/20 hover:text-fg',
                  )}
                >
                  <AvatarChip avatar={a} size={32} />
                  <span className="flex flex-col items-start leading-tight">
                    {a.name}
                    <span className="text-[11px] font-normal text-fg-subtle">{a.kind}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <ul className="mt-5 grid grid-cols-3 gap-2 lg:mt-8 lg:grid-cols-1 lg:gap-0 lg:divide-y lg:divide-line lg:border-y lg:border-line" aria-label="Device check">
          {checks.map((c) => (
            <li key={c.label} className="flex min-w-0 flex-col gap-1 rounded-card border border-line bg-white/[0.02] p-2.5 lg:flex-row lg:items-center lg:gap-3 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-3">
              <c.icon className={cn('size-4 shrink-0', c.ok ? 'text-fg-muted' : 'text-warning')} aria-hidden />
              <span className="text-[12px] font-medium lg:w-28 lg:text-[13px]">{c.label}</span>
              <span className={cn('text-[11px] leading-snug lg:text-[13px]', c.ok ? 'text-fg-subtle' : 'text-warning')}>{c.value}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center lg:mt-8">
          <Button variant="accent" size="lg" leftIcon={<Sparkles />} onClick={onStart} disabled={!online} className="w-full sm:w-auto">
            Start conversation
          </Button>
          <p className="text-center text-[12px] text-fg-subtle sm:text-left">Nothing starts until you press Start.</p>
        </div>

        <p className="mt-6 hidden items-center gap-2 text-[12px] text-fg-subtle lg:flex">
          <Clapperboard className="size-3.5" aria-hidden />
          {avatar.name} also powers {avatar.usage.videos} videos and {avatar.usage.agents} agents — one avatar, many experiences.
        </p>
        {isDemo && (
          <div className="mt-4 hidden lg:block">
            <DemoNote>Live sessions are simulated in demo mode — no microphone or camera is accessed.</DemoNote>
          </div>
        )}
      </div>
    </div>
  )
}
