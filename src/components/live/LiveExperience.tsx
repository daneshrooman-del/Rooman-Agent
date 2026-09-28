import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessagesSquare, MicOff, VolumeX } from 'lucide-react'
import type { Agent } from '@/types'
import { useWorkspace } from '@/state/workspace'
import { useOnline } from '@/hooks/useOnline'
import { Dialog, StatusIndicator } from '@/components/ui'
import { LiveStage, connectionLabel, connectionToStatus } from './LiveStage'
import { ControlBar } from './ControlBar'
import { LiveComposer } from './LiveComposer'
import { LiveLobby } from './LiveLobby'
import { LiveSidePanel, type SideTab } from './LiveSidePanel'
import { LiveSettingsDialog, type LiveSettings } from './LiveSettingsDialog'
import { SessionSummary } from './SessionSummary'
import { ExitButton } from './ExitButton'
import { AvatarSwitcher, Captions, SelfViewTile, SessionTimer, useSessionClock } from './session'
import { useLiveConversation } from './useLiveConversation'
import { LIVE_VOICE_PROMPTS, createLiveResponder, type LiveConfig } from './liveScript'
import { createAgentResponder } from './agentScript'
import type { ConfigDraft } from './AgentConfigPanel'

const DEFAULT_TOOLS = ['Knowledge search', 'Calendar', 'CRM', 'Email', 'Human handoff']

/** The Live AI experience: lobby → immersive session → summary. */
export function LiveExperience({ initialAvatarId, agent }: { initialAvatarId: string; agent?: Agent }) {
  const { data, avatarById, voiceName } = useWorkspace()
  const navigate = useNavigate()
  const online = useOnline()
  const [avatarId, setAvatarId] = useState(initialAvatarId)
  const avatar = avatarById(avatarId) ?? avatarById(initialAvatarId)!

  const [config, setConfig] = useState<ConfigDraft>(() => {
    const docs =
      agent?.knowledge.map((k) => k.name) ??
      (data?.assets ?? [])
        .filter((a) => a.kind === 'document')
        .map((a) => a.name)
        .slice(0, 4)
    const tools = agent?.tools ?? DEFAULT_TOOLS.map((name, i) => ({ name, enabled: i !== 2 && i !== 3 }))
    return {
      personality: agent?.personality ?? `Warm, clear and helpful. Speaks the way ${avatar.name} would — confident, never pushy.`,
      goals: agent?.goals.join('\n') ?? 'Explain what the company does\nAnswer product and pricing questions\nBook a demo when there’s interest',
      knowledge: Object.fromEntries(docs.map((n, i) => [n, agent ? true : i < 2])),
      tools: Object.fromEntries(tools.map((t) => [t.name, t.enabled])),
      language: agent?.languages[0] ?? avatar.languages[0] ?? 'English',
    }
  })
  const [settings, setSettings] = useState<Omit<LiveSettings, 'language'>>({ voiceId: agent?.voiceId ?? avatar.voiceId, style: 'balanced', captions: true })
  const [mic, setMic] = useState(true)
  const [camera, setCamera] = useState(false)
  const [speaker, setSpeaker] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tab, setTab] = useState<SideTab>('conversation')
  const [sheet, setSheet] = useState(false)

  // Latest config for the scripted responder (read at reply time).
  const cfgRef = useRef<LiveConfig & { avatarName: string }>(null!)
  cfgRef.current = {
    personality: config.personality,
    goals: config.goals,
    knowledge: Object.keys(config.knowledge).filter((k) => config.knowledge[k]),
    tools: Object.keys(config.tools).filter((k) => config.tools[k]),
    language: config.language,
    style: settings.style,
    avatarName: avatar.name,
  }

  const responder = useMemo(
    () => (agent ? createAgentResponder(agent, avatar.name, voiceName(agent.voiceId)) : createLiveResponder(() => cfgRef.current)),
    // avatar name is only used for the agent's intro line
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agent],
  )

  const conv = useLiveConversation({
    responder,
    greeting: agent
      ? `Hi, I’m ${avatar.name}, here as your ${agent.name}. How can I help today?`
      : `Hi, I’m ${avatar.name}. It’s great to meet you. Ask me anything — about our company, our products, or what an AI agent could do for your team.`,
    voicePrompts: LIVE_VOICE_PROMPTS,
  })

  const running = conv.status !== 'idle' && conv.status !== 'ended'
  const elapsed = useSessionClock(conv.startedAt, running)
  const duration = conv.startedAt && conv.endedAt ? Math.round((conv.endedAt - conv.startedAt) / 1000) : elapsed

  // Close any open overlays when the session ends.
  useEffect(() => {
    if (conv.status === 'ended') {
      setSheet(false)
      setSettingsOpen(false)
    }
  }, [conv.status])

  const languages = Array.from(new Set([...(avatar.languages ?? []), ...(agent?.languages ?? []), 'English']))
  const lastAvatarLine = [...conv.items].reverse().find((i) => i.type === 'message' && i.speaker === 'avatar')
  const userName = data?.user.name ?? 'You'

  const turnIntoAgent = () => {
    navigate(`/agents/new?avatar=${avatar.id}`, {
      state: {
        fromLive: {
          avatarId: avatar.id,
          personality: config.personality,
          goals: config.goals
            .split('\n')
            .map((g) => g.trim())
            .filter(Boolean),
          transcript: conv.items.flatMap((i) => (i.type === 'message' ? [{ speaker: i.speaker, text: i.text }] : [])),
        },
      },
    })
  }

  if (conv.status === 'idle') {
    return <LiveLobby avatar={avatar} onAvatar={setAvatarId} onStart={conv.connect} online={online} agentName={agent?.name} />
  }

  if (conv.status === 'ended') {
    return <SessionSummary avatar={avatar} durationSec={duration} items={conv.items} onTurnIntoAgent={turnIntoAgent} onRestart={conv.reset} />
  }

  const panelProps = {
    tab,
    onTab: setTab,
    conv,
    avatar,
    avatarName: avatar.name,
    micOn: mic,
    config,
    onConfig: (p: Partial<ConfigDraft>) => setConfig((c) => ({ ...c, ...p })),
    languages,
    onTurnIntoAgent: turnIntoAgent,
  }
  const showCaptions = (settings.captions || !speaker) && conv.phase !== 'listening' && lastAvatarLine?.type === 'message'

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-canvas lg:grid lg:h-[calc(100dvh-64px-48px)] lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-5 lg:bg-transparent xl:grid-cols-[minmax(0,1fr)_420px]">
      <h1 className="sr-only">Live conversation with {avatar.name}</h1>

      <div className="relative flex min-h-0 flex-1 flex-col lg:h-full">
        <LiveStage
          avatar={avatar}
          status={conv.status}
          phase={conv.phase}
          micLevel={conv.micLevel}
          framing="portrait"
          rounded="rounded-none lg:rounded-hero"
          className="min-h-0 flex-1 lg:h-full lg:border lg:border-line"
          pillClassName="top-[84px] sm:top-24"
          ringClassName="bottom-[14%] lg:bottom-[150px]"
        >
          {/* Top bar */}
          <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2.5 bg-gradient-to-b from-black/70 to-transparent p-3 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-3 sm:p-5 sm:pb-10">
            <ExitButton />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="truncate font-display text-[15px] font-semibold tracking-[-0.01em] sm:text-[17px]">
                  {avatar.name} AI{agent && <span className="hidden font-normal text-fg-muted sm:inline"> · {agent.name}</span>}
                </span>
                <StatusIndicator variant="inline" status={connectionToStatus(conv.status)} label={connectionLabel(conv.status)} />
              </div>
              <SessionTimer seconds={elapsed} className="text-[12px] sm:text-[13px]" />
            </div>
            <AvatarSwitcher value={avatar.id} onChange={setAvatarId} />
            <button
              type="button"
              aria-label="Open conversation and agent configuration"
              onClick={() => setSheet(true)}
              className="glass-strong relative flex size-10 shrink-0 items-center justify-center rounded-full text-fg lg:hidden"
            >
              <MessagesSquare className="size-[18px]" aria-hidden />
              {conv.messageCount > 0 && (
                <span className="tabular absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                  {conv.messageCount}
                </span>
              )}
            </button>
          </div>

          {/* Device state chips */}
          {(!mic || !speaker) && (
            <div className="absolute left-3 top-[76px] z-10 flex flex-col gap-1.5 sm:left-5 sm:top-[92px]">
              {!mic && (
                <span className="glass-strong inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] text-fg-muted">
                  <MicOff className="size-3.5" aria-hidden /> Mic muted
                </span>
              )}
              {!speaker && (
                <span className="glass-strong inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] text-fg-muted">
                  <VolumeX className="size-3.5" aria-hidden /> Speaker off · captions on
                </span>
              )}
            </div>
          )}

          {camera && <SelfViewTile name={userName} className="absolute right-3 top-[76px] z-10 sm:right-5 sm:top-[92px]" />}
        </LiveStage>
        {/* Bottom: captions, composer (mobile), controls */}
        <div className="relative z-10 -mt-24 flex shrink-0 flex-col gap-4 bg-gradient-to-t from-canvas from-60% to-transparent px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-16 sm:px-6 lg:absolute lg:inset-x-px lg:bottom-px lg:mt-0 lg:rounded-b-hero lg:from-black/85 lg:from-0% lg:via-black/45 lg:pb-6 lg:pt-20">
          {showCaptions && <Captions text={lastAvatarLine.text} />}
          <LiveComposer
            className="lg:hidden"
            onSend={(t) => conv.send(t)}
            onSpeak={() => conv.speak()}
            listening={conv.phase === 'listening'}
            disabled={!conv.canTalk}
            micDisabled={!mic}
            placeholder={`Message ${avatar.name}`}
            label={`Message ${avatar.name}`}
          />
          <ControlBar
            mic={mic}
            camera={camera}
            speaker={speaker}
            onMic={() => setMic((m) => !m)}
            onCamera={() => setCamera((c) => !c)}
            onSpeaker={() => setSpeaker((s) => !s)}
            onSettings={() => setSettingsOpen(true)}
            onEnd={conv.end}
            showLabels
          />
        </div>
      </div>

      {/* Desktop side panel */}
      <aside aria-label="Conversation and agent configuration" className="surface hidden min-h-0 overflow-hidden rounded-panel lg:flex lg:flex-col">
        <LiveSidePanel idBase="live-side" className="h-full" {...panelProps} />
      </aside>

      {/* Mobile sheet */}
      <Dialog open={sheet} onClose={() => setSheet(false)} title="Conversation" description={`${avatar.name} AI · ${connectionLabel(conv.status)}`}>
        <div className="-mx-6 -my-4 h-[62dvh]">
          <LiveSidePanel idBase="live-sheet" className="h-full" {...panelProps} />
        </div>
      </Dialog>

      <LiveSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        value={{ ...settings, language: config.language }}
        onChange={({ language, ...rest }) => {
          if (language) setConfig((c) => ({ ...c, language }))
          if (Object.keys(rest).length) setSettings((s) => ({ ...s, ...rest }))
        }}
        languages={languages}
      />
    </div>
  )
}
