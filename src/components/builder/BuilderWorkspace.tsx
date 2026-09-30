import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, MessagesSquare, RotateCcw } from 'lucide-react'
import type { Avatar } from '@/types'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useWorkspace } from '@/state/workspace'
import { Button } from '@/components/ui/Button'
import { DemoNote } from '@/components/ui/States'
import { SegmentedControl } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import { AvatarChip } from '@/components/avatar/AvatarPreview'
import { ChatThread } from './ChatThread'
import { Composer } from './Composer'
import { ConfigPanel } from './ConfigPanel'
import { ProgressRail } from './ProgressRail'
import { toAgent, type FromLive } from './templates'
import { useBuilder } from './useBuilder'

export function BuilderWorkspace({
  avatar,
  initialPrompt,
  fromLive,
  onRestart,
}: {
  avatar: Avatar | undefined
  initialPrompt?: string
  fromLive?: FromLive
  onRestart: () => void
}) {
  const { data, isDemo, avatarById, voiceName, addAgent } = useWorkspace()
  const navigate = useNavigate()
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const [tab, setTab] = useState<'chat' | 'agent'>('chat')
  const [busy, setBusy] = useState<'test' | 'deploy' | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const fallbackVoice = data?.voices[0]?.id ?? ''
  const b = useBuilder({
    avatar: { id: avatar?.id ?? '', voiceId: avatar?.voiceId ?? fallbackVoice },
    names: (cfg) => ({ avatar: avatarById(cfg.avatarId)?.name ?? 'your avatar', voice: voiceName(cfg.voiceId) }),
    fromLive: fromLive ? { ...fromLive, avatarName: avatar?.name } : undefined,
    initialPrompt,
    owner: data?.user.email ?? data?.user.id,
  })

  const running = b.state === 'running' || b.typing
  const send = () => {
    if (!draft.trim() || running) return
    b.send(draft)
    setDraft('')
  }

  const create = async (status: 'draft' | 'live') => {
    if (!b.config) return
    setBusy(status === 'draft' ? 'test' : 'deploy')
    try {
      const agent = await api.createAgent(toAgent(b.config, status))
      addAgent(agent)
      if (status === 'live') {
        toast({ title: `${agent.name} is live`, description: `Deployed with ${avatarById(agent.avatarId)?.name ?? 'your avatar'} on ${agent.channels.length} channel${agent.channels.length > 1 ? 's' : ''}.` })
        navigate(`/agents/${agent.id}`)
      } else {
        navigate(`/agents/${agent.id}?tab=test`)
      }
    } catch (e) {
      setBusy(null)
      toast({ tone: 'error', title: 'Could not create the agent', description: e instanceof Error ? e.message : 'Please try again.' })
    }
  }

  const placeholder = running
    ? 'The builder is working…'
    : b.state === 'idle'
      ? 'Add anything else, or describe the job…'
      : 'Refine it — e.g. “Also make it speak Hindi”'

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3 sm:items-center">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            Agent Builder
            {avatar && (
              <span className="inline-flex items-center gap-1.5 normal-case tracking-normal text-fg-muted">
                · <AvatarChip avatar={avatar} size={16} /> Powered by {avatar.name}
              </span>
            )}
          </p>
          <h1 className="mt-1.5 text-[24px] font-semibold leading-tight tracking-[-0.02em] sm:text-[28px]">
            {b.config ? b.config.name : fromLive ? 'Turn your conversation into an agent' : 'Building your agent'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {isDemo && (
            <div className="hidden sm:block">
              <DemoNote>Simulated build — agents are saved to this demo workspace.</DemoNote>
            </div>
          )}
          <Button variant="ghost" size="sm" leftIcon={<RotateCcw aria-hidden />} onClick={onRestart} disabled={busy !== null}>
            Start over
          </Button>
        </div>
      </header>

      <ProgressRail stage={b.stage} />

      <div className="lg:hidden">
        <SegmentedControl
          label="Builder view"
          value={tab}
          onChange={setTab}
          className="w-full"
          options={[
            { value: 'chat', label: 'Chat', icon: <MessagesSquare aria-hidden /> },
            { value: 'agent', label: b.config ? 'Agent' : 'Agent', icon: <Bot aria-hidden /> },
          ]}
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:gap-8">
        {/* conversation */}
        <section
          aria-label="Conversation"
          className={cn(
            'flex-col lg:sticky lg:top-[88px] lg:flex lg:h-[calc(100dvh-272px)] lg:min-h-[480px] lg:rounded-panel lg:border lg:border-line lg:bg-surface/60',
            tab === 'chat' ? 'flex' : 'hidden',
          )}
        >
          <div ref={scrollRef} className="flex-1 lg:overflow-y-auto lg:px-5 lg:pt-5">
            <ChatThread
              messages={b.messages}
              typing={b.typing}
              onStreamed={b.markStreamed}
              scrollRef={scrollRef}
              canBuildLive={b.state === 'idle'}
              onBuildLive={() => b.build('')}
              onViewAgent={() => {
                setTab('agent')
                window.scrollTo({ top: 0 })
              }}
            />
          </div>
          <div className="sticky bottom-[84px] z-10 -mx-4 mt-5 bg-gradient-to-t from-canvas via-canvas/95 to-transparent px-4 pb-2 pt-4 sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:mt-0 lg:bg-none lg:p-4">
            <Composer value={draft} onChange={setDraft} onSend={send} disabled={running} placeholder={placeholder} label="Message the AI Builder" />
          </div>
        </section>

        {/* generated configuration */}
        <div className={cn('min-w-0 lg:block', tab === 'agent' ? 'block' : 'hidden')}>
          <ConfigPanel
            cfg={b.config}
            state={b.state}
            stage={b.stage}
            revealed={b.revealed}
            flash={b.flash}
            update={b.update}
            onTest={() => create('draft')}
            onDeploy={() => create('live')}
            busy={busy}
          />
        </div>
      </div>
    </div>
  )
}
