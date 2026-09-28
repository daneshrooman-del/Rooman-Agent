import { Clock, MessagesSquare, RotateCcw, Wand2, Zap } from 'lucide-react'
import type { Avatar } from '@/types'
import { formatDuration } from '@/lib/format'
import { Button } from '@/components/ui'
import { AvatarChip } from '@/components/avatar/AvatarPreview'
import type { TranscriptItem } from './types'
import { ExitButton } from './ExitButton'

/** Tidy end-of-session recap with the two next steps. */
export function SessionSummary({
  avatar,
  durationSec,
  items,
  onTurnIntoAgent,
  onRestart,
}: {
  avatar: Avatar
  durationSec: number
  items: TranscriptItem[]
  onTurnIntoAgent: () => void
  onRestart: () => void
}) {
  const messages = items.filter((i) => i.type === 'message')
  const steps = items.filter((i) => i.type === 'event' && i.kind !== 'response').length
  const lastUser = [...messages].reverse().find((m) => m.speaker === 'user')

  const stats = [
    { icon: Clock, label: 'Duration', value: formatDuration(durationSec) },
    { icon: MessagesSquare, label: 'Messages', value: String(messages.length) },
    { icon: Zap, label: 'Agent steps', value: String(steps) },
  ]

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-canvas px-5 py-16 lg:min-h-[calc(100dvh-64px-48px)] lg:bg-transparent lg:py-6">
      <ExitButton className="absolute left-4 top-4" />
      <div className="w-full max-w-lg animate-fade-up text-center">
        <AvatarChip avatar={avatar} size={88} className="mx-auto shadow-glow" />
        <p className="mt-6 text-[12px] font-medium uppercase tracking-[0.14em] text-fg-subtle">Session ended</p>
        <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">Great conversation with {avatar.name}</h1>
        {lastUser && lastUser.type === 'message' && (
          <p className="mx-auto mt-3 max-w-md text-[14px] text-fg-muted">Last topic: “{lastUser.text}”</p>
        )}

        <dl className="mt-8 grid grid-cols-3 divide-x divide-line rounded-panel border border-line bg-white/[0.02]">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 px-3 py-5">
              <s.icon className="size-4 text-fg-subtle" aria-hidden />
              <dt className="text-[12px] text-fg-subtle">{s.label}</dt>
              <dd className="tabular text-[22px] font-semibold">{s.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="accent" size="lg" leftIcon={<Wand2 />} onClick={onTurnIntoAgent} disabled={messages.length === 0}>
            Turn this conversation into an agent
          </Button>
          <Button variant="secondary" size="lg" leftIcon={<RotateCcw />} onClick={onRestart}>
            Start new session
          </Button>
        </div>
        <p className="mt-4 text-[12px] text-fg-subtle">Your personality, goals and transcript carry over into the Agent Builder.</p>
      </div>
    </div>
  )
}
