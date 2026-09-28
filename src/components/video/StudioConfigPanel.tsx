import { useId, type ReactNode } from 'react'
import { AudioLines, Globe2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ActionType, AspectRatio, Scene } from '@/types'
import { useWorkspace } from '@/state/workspace'
import { ChoiceChips, Field, SegmentedControl, Select, Textarea } from '@/components/ui/Form'
import { AvatarPicker } from '@/components/avatar/AvatarPicker'
import { SceneTiles } from './SceneTiles'
import { ACTIONS, ASPECTS, EXAMPLE_PROMPTS, LANGUAGES, PROMPT_MAX, PROMPT_MIN } from './studio'

export interface StudioSettings {
  avatarId: string
  voiceId: string
  language: string
  prompt: string
  action: ActionType
  scene: Scene
  aspect: AspectRatio
  background: File | null
}

function Section({ step, title, children, className }: { step: number; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('border-t border-line px-5 py-5 first:border-t-0 sm:px-6', className)} aria-label={title}>
      <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        <span className="tabular text-fg-muted">{String(step).padStart(2, '0')}</span>
        {title}
      </p>
      {children}
    </section>
  )
}

/** Left-hand configuration form of the Create Video studio. */
export function StudioConfigPanel({
  value,
  onChange,
  onAvatarChange,
  disabled,
}: {
  value: StudioSettings
  onChange: (patch: Partial<StudioSettings>) => void
  onAvatarChange: (id: string) => void
  disabled?: boolean
}) {
  const { data, avatarById } = useWorkspace()
  const promptId = useId()
  const voiceId = useId()
  const langId = useId()
  const avatar = avatarById(value.avatarId)
  const len = value.prompt.trim().length

  const voices = data?.voices ?? []
  const own = voices.filter((v) => v.avatarId === value.avatarId)
  const others = voices.filter((v) => v.avatarId !== value.avatarId)
  const voiceOptions = [...own, ...others].map((v) => ({
    value: v.id,
    label: `${v.name} · ${v.avatarId === value.avatarId ? 'Cloned voice' : v.kind === 'cloned' ? 'Cloned' : 'Stock'} — ${v.tone}`,
  }))
  const languages = [...new Set([...(avatar?.languages ?? []), ...LANGUAGES])]

  return (
    <fieldset disabled={disabled} className="min-w-0 transition-opacity duration-300 disabled:opacity-60">
      <legend className="sr-only">Video settings</legend>

      <Section step={1} title="Identity">
        <div className="flex flex-col gap-4">
          <AvatarPicker value={value.avatarId} onChange={onAvatarChange} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Field label="Voice" htmlFor={voiceId}>
              <Select
                id={voiceId}
                value={value.voiceId}
                onChange={(e) => onChange({ voiceId: e.target.value })}
                leading={<AudioLines className="size-4 text-fg-subtle" aria-hidden />}
                options={voiceOptions}
              />
            </Field>
            <Field label="Language" htmlFor={langId}>
              <Select
                id={langId}
                value={value.language}
                onChange={(e) => onChange({ language: e.target.value })}
                leading={<Globe2 className="size-4 text-fg-subtle" aria-hidden />}
                options={languages.map((l) => ({ value: l, label: l }))}
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section step={2} title="Direction">
        <Field
          label="What should your avatar do?"
          htmlFor={promptId}
          trailing={
            <span className={cn('tabular text-[12px]', len > 0 && len < PROMPT_MIN ? 'text-warning' : 'text-fg-subtle')} aria-live="polite">
              {value.prompt.length}/{PROMPT_MAX}
            </span>
          }
        >
          <Textarea
            id={promptId}
            value={value.prompt}
            maxLength={PROMPT_MAX}
            onChange={(e) => onChange({ prompt: e.target.value })}
            placeholder="Describe what you want your avatar to say or do..."
            className="min-h-36 text-[15px]"
          />
        </Field>
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Example prompts">
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange({ prompt: p })}
              className={cn(
                'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-left text-[12px] transition-colors',
                value.prompt === p ? 'border-accent/40 bg-accent/10 text-fg' : 'border-line bg-white/[0.02] text-fg-muted hover:border-white/20 hover:text-fg',
              )}
            >
              <Sparkles className="size-3 shrink-0 text-accent" aria-hidden />
              {p}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <p className="mb-2.5 text-[13px] font-medium" id={`${promptId}-action`}>
            Action
          </p>
          <ChoiceChips
            label="Action type"
            value={value.action}
            onChange={(action) => onChange({ action })}
            options={ACTIONS.map((a) => ({ value: a.value, label: a.label, icon: <a.icon aria-hidden /> }))}
          />
        </div>
      </Section>

      <Section step={3} title="Scene & format">
        <p className="mb-2.5 text-[13px] font-medium">Background</p>
        <SceneTiles
          value={value.scene}
          onChange={(scene) => onChange({ scene })}
          avatar={avatar}
          background={value.background}
          onBackground={(background) => onChange({ background })}
          disabled={disabled}
        />
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-[13px] font-medium">Aspect ratio</p>
          <SegmentedControl
            label="Aspect ratio"
            value={value.aspect}
            onChange={(aspect) => onChange({ aspect })}
            options={ASPECTS.map((a) => ({ value: a.value, label: a.label, icon: <AspectGlyph ratio={a.value} /> }))}
          />
        </div>
      </Section>
    </fieldset>
  )
}

function AspectGlyph({ ratio }: { ratio: AspectRatio }) {
  const size = ratio === '16:9' ? 'h-2 w-3.5' : ratio === '9:16' ? 'h-3.5 w-2' : 'size-2.5'
  return <span aria-hidden className={cn('inline-block rounded-[2px] border border-current opacity-70', size)} />
}
