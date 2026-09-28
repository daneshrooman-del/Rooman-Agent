import { useId } from 'react'
import { Field, Select, Textarea, Toggle } from '@/components/ui'

export interface ConfigDraft {
  personality: string
  goals: string
  knowledge: Record<string, boolean>
  tools: Record<string, boolean>
  language: string
}

/** Lightweight, local-state agent configuration used during a live session. */
export function AgentConfigPanel({
  value,
  onChange,
  avatarName,
  languages,
}: {
  value: ConfigDraft
  onChange: (patch: Partial<ConfigDraft>) => void
  avatarName: string
  languages: string[]
}) {
  const pId = useId()
  const gId = useId()
  const lId = useId()
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-5">
      <p className="text-[13px] text-fg-muted">Shape how {avatarName} behaves in this session. Changes apply to the next reply — and carry over when you turn this into an agent.</p>
      <Field label="Personality" htmlFor={pId}>
        <Textarea id={pId} rows={3} className="min-h-20" value={value.personality} onChange={(e) => onChange({ personality: e.target.value })} />
      </Field>
      <Field label="Goals" htmlFor={gId} hint="One goal per line.">
        <Textarea id={gId} rows={3} className="min-h-20" value={value.goals} onChange={(e) => onChange({ goals: e.target.value })} />
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-[13px] font-medium">Knowledge</legend>
        {Object.keys(value.knowledge).length === 0 && <p className="text-[13px] text-fg-subtle">No documents in this workspace yet.</p>}
        {Object.entries(value.knowledge).map(([name, on]) => (
          <Toggle key={name} label={<span className="break-all text-[13px] font-normal text-fg-muted">{name}</span>} checked={on} onChange={(v) => onChange({ knowledge: { ...value.knowledge, [name]: v } })} />
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-[13px] font-medium">Tools</legend>
        {Object.entries(value.tools).map(([name, on]) => (
          <Toggle key={name} label={<span className="text-[13px] font-normal text-fg-muted">{name}</span>} checked={on} onChange={(v) => onChange({ tools: { ...value.tools, [name]: v } })} />
        ))}
      </fieldset>
      <Field label="Language" htmlFor={lId}>
        <Select id={lId} value={value.language} onChange={(e) => onChange({ language: e.target.value })} options={languages.map((l) => ({ value: l, label: l }))} />
      </Field>
    </div>
  )
}
