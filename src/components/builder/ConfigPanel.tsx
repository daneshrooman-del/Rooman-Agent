import type { ComponentType } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Skeleton } from '@/components/ui/States'
import { AgentHeroCard } from './AgentHeroCard'
import { CallerSection, GoalsSection, GuardrailsSection, KnowledgeSection, PurposeSection, type SectionProps } from './ProfileSections'
import { AvatarSection, ChannelsSection, LanguagesSection, ToolsSection, VoiceSection, WorkflowSection } from './CapabilitySections'
import type { BuilderConfig, SectionKey } from './templates'
import type { BuildState } from './useBuilder'

const LAYOUT: { key: SectionKey; C: ComponentType<SectionProps>; full?: boolean; label: string }[] = [
  { key: 'purpose', C: PurposeSection, full: true, label: 'Purpose' },
  { key: 'caller', C: CallerSection, label: 'Caller' },
  { key: 'goals', C: GoalsSection, label: 'Goals' },
  { key: 'workflow', C: WorkflowSection, full: true, label: 'Workflow' },
  { key: 'knowledge', C: KnowledgeSection, full: true, label: 'Knowledge' },
  { key: 'avatar', C: AvatarSection, label: 'Avatar' },
  { key: 'voice', C: VoiceSection, label: 'Voice' },
  { key: 'tools', C: ToolsSection, label: 'Tools' },
  { key: 'guardrails', C: GuardrailsSection, label: 'Guardrails' },
  { key: 'languages', C: LanguagesSection, label: 'Languages' },
  { key: 'channels', C: ChannelsSection, label: 'Channels' },
]

export function ConfigPanel({
  cfg,
  state,
  stage,
  revealed,
  flash,
  update,
  onTest,
  onDeploy,
  busy,
}: {
  cfg: BuilderConfig | null
  state: BuildState
  stage: number
  revealed: Set<SectionKey>
  flash: { keys: SectionKey[]; n: number }
  update: (patch: Partial<BuilderConfig>, keys: SectionKey[]) => void
  onTest: () => void
  onDeploy: () => void
  busy: 'test' | 'deploy' | null
}) {
  if (!cfg) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-panel border border-dashed border-line-strong p-8 text-center">
        <span className={cn('flex size-12 items-center justify-center rounded-full border border-accent/25 bg-accent/10 text-accent', state === 'running' && 'animate-pulse-soft')}>
          <Sparkles className="size-5" aria-hidden />
        </span>
        <p className="mt-4 text-[15px] font-medium">{state === 'running' ? 'Reading your description…' : 'Your agent will take shape here'}</p>
        <p className="mt-1 max-w-xs text-[13px] text-fg-muted">Purpose, workflow, knowledge, avatar, tools and channels — generated from the conversation.</p>
      </div>
    )
  }

  const flashFor = (k: SectionKey) => (flash.keys.includes(k) ? flash.n : 0)
  const visible = LAYOUT.filter((s) => revealed.has(s.key))
  const next = state === 'running' ? LAYOUT.find((s) => !revealed.has(s.key)) : undefined

  return (
    <div className="flex flex-col gap-4">
      <AgentHeroCard cfg={cfg} state={state} stage={stage} onRename={(name) => update({ name }, [])} onTest={onTest} onDeploy={onDeploy} busy={busy} />

      <div className="mt-2 flex items-center justify-between px-1">
        <h2 className="text-[13px] font-medium uppercase tracking-[0.14em] text-fg-subtle">Generated configuration</h2>
        <span className="tabular text-[12px] text-fg-subtle">
          {visible.length}/{LAYOUT.length} sections
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {visible.map(({ key, C, full }) => (
          <div key={key} className={cn('min-w-0', full && 'xl:col-span-2')}>
            <C cfg={cfg} update={update} flash={flashFor} />
          </div>
        ))}
        {next && (
          <div className={cn('animate-fade-in rounded-card border border-line bg-surface/60 p-5 sm:p-6', next.full && 'xl:col-span-2')} aria-hidden>
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-7 rounded-[8px]" />
              <span className="text-[13px] text-fg-subtle">Generating {next.label.toLowerCase()}…</span>
            </div>
            <Skeleton className="mt-5 h-3 w-4/5" />
            <Skeleton className="mt-2.5 h-3 w-3/5" />
          </div>
        )}
      </div>
    </div>
  )
}
