import { useMemo } from 'react'
import { AudioLines, BookOpen, GitBranch, RotateCcw, ShieldCheck, Wrench, type LucideIcon } from 'lucide-react'
import type { Agent } from '@/types'
import { api } from '@/lib/api'
import { useWorkspace } from '@/state/workspace'
import { Button, DemoNote, StatusIndicator } from '@/components/ui'
import { AvatarChip } from '@/components/avatar/AvatarPreview'
import { LiveStage, connectionLabel, connectionToStatus } from './LiveStage'
import { Transcript, eventMeta } from './Transcript'
import { LiveComposer } from './LiveComposer'
import { useLiveConversation } from './useLiveConversation'
import { agentScenarios, createAgentResponder, type ScenarioId } from './agentScript'

const scenarioIcon: Record<ScenarioId, LucideIcon> = {
  voice: AudioLines,
  knowledge: BookOpen,
  workflow: GitBranch,
  tools: Wrench,
  guardrails: ShieldCheck,
}

/**
 * "Live Test" tab of the Agent command center: talk to the agent through its
 * avatar and watch each step it takes (knowledge lookups, tool calls,
 * workflow transitions, guardrails) appear in the transcript.
 */
export default function AgentLiveTest({ agent }: { agent: Agent }) {
  const { avatarById, voiceName, isDemo } = useWorkspace()
  const avatar = avatarById(agent.avatarId)
  const avatarName = avatar?.name ?? 'Avatar'
  const visual = avatar ?? { hue: 255, name: avatarName }
  const scenarios = useMemo(() => agentScenarios(agent), [agent])
  const responder = useMemo(
    () => createAgentResponder(agent, avatarName, voiceName(agent.voiceId)),
    [agent, avatarName, voiceName],
  )
  const conv = useLiveConversation({
    responder,
    autoConnect: true,
    greeting: `Hi, I’m ${agent.name}, speaking as ${avatarName}. Try one of the quick tests above, or just talk to me.`,
    voicePrompts: scenarios.map((s) => s.prompt),
    startSession: () => api.startAgentConversation(agent.id),
  })
  const busy = conv.phase === 'listening'

  const run = (id: ScenarioId, prompt: string) => {
    if (id === 'voice') conv.speak(prompt, { scenario: id })
    else conv.send(prompt, { scenario: id })
  }

  return (
    <section aria-labelledby="live-test-title" className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="live-test-title" className="text-[19px] font-semibold">
            Test {agent.name} live
          </h2>
          <p className="mt-1 text-[14px] text-fg-muted">
            Talk to your agent as a caller would. Each step it takes shows up in the conversation.
          </p>
        </div>
        <Button variant="ghost" size="sm" leftIcon={<RotateCcw />} onClick={conv.connect}>
          Restart test
        </Button>
      </div>

      {/* Quick test scenarios */}
      <div className="mt-5">
        <p className="text-[13px] font-medium" id="quick-tests-label">
          Quick tests
        </p>
        <div
          role="group"
          aria-labelledby="quick-tests-label"
          className="no-scrollbar -mx-4 mt-2.5 flex snap-x gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          {scenarios.map((s) => {
            const Icon = scenarioIcon[s.id]
            return (
              <button
                key={s.id}
                type="button"
                disabled={!conv.canTalk || busy}
                onClick={() => run(s.id, s.prompt)}
                title={s.prompt}
                className="group flex h-11 shrink-0 snap-start items-center gap-2.5 rounded-full border border-line-strong bg-white/[0.03] pl-2 pr-4 text-left transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-45"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-white/[0.07] text-fg-muted group-hover:text-fg">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[13px] font-medium text-fg">Test {s.label.toLowerCase()}</span>
                  <span className="text-[11px] text-fg-subtle">{s.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Live avatar */}
        <LiveStage
          avatar={visual}
          status={conv.status}
          phase={conv.phase}
          micLevel={conv.micLevel}
          framing="portrait"
          rounded="rounded-panel"
          className="h-[320px] border border-line sm:h-[400px] lg:h-[560px]"
        >
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3 sm:p-4">
            <span className="glass-strong inline-flex min-w-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[12px]">
              <AvatarChip avatar={visual} size={24} />
              <span className="truncate">
                <span className="text-fg-subtle">Powered by </span>
                <span className="font-medium text-fg">{avatarName}</span>
              </span>
            </span>
            <span className="glass-strong rounded-full">
              <StatusIndicator status={connectionToStatus(conv.status)} label={connectionLabel(conv.status)} />
            </span>
          </div>
        </LiveStage>

        {/* Conversation */}
        <div className="surface flex h-[480px] min-w-0 flex-col overflow-hidden rounded-panel lg:h-[560px]">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">Conversation</h3>
            <span className="text-[12px] text-fg-subtle tabular">{conv.messageCount} messages</span>
          </div>
          <Transcript
            items={conv.items}
            avatar={visual}
            avatarName={avatarName}
            className="flex-1"
            empty={<p className="py-8 text-center text-[13px] text-fg-subtle">Connecting to {agent.name}…</p>}
          />
          <div className="border-t border-line p-3 sm:p-4">
            <LiveComposer
              onSend={(t) => conv.send(t)}
              onSpeak={() => conv.speak()}
              listening={busy}
              disabled={!conv.canTalk}
              placeholder="Talk to your agent"
              label="Talk to your agent"
            />
          </div>
        </div>
      </div>

      {/* Legend for non-technical users */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-fg-subtle">
        {(['knowledge', 'tool', 'workflow', 'guardrail'] as const).map((k) => {
          const m = eventMeta[k]
          const Icon = m.icon
          return (
            <span key={k} className="inline-flex items-center gap-1.5">
              <Icon className="size-3.5" aria-hidden />
              <span className="text-fg-muted">{m.label}</span> = {m.explain.toLowerCase()}
            </span>
          )
        })}
      </div>
      {isDemo && <DemoNote className="mt-3">Simulated conversation — replies are scripted from this agent’s setup.</DemoNote>}
    </section>
  )
}
