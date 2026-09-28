import { useId, useState } from 'react'
import { Plus, ShieldCheck, X } from 'lucide-react'
import type { Agent } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input, Toggle } from '@/components/ui/Form'
import { SectionHeader } from '@/components/ui/PageHeader'
import { useAgentActions } from '../useAgentActions'

/* Policy toggles are stored as guardrail rules so they travel with the agent. */
const policies = [
  { rule: 'Require human handoff for legal questions', description: 'Legal, contract and compliance topics route to a person.' },
  { rule: 'Redact personal data in transcripts', description: 'Phone numbers, emails and IDs are masked before storage.' },
  { rule: 'Disclose that the caller is speaking with an AI', description: 'The agent introduces itself as an AI assistant.' },
  { rule: 'Stay within the configured knowledge', description: 'Declines questions it cannot answer from its sources.' },
]

export function GuardrailsTab({ agent }: { agent: Agent }) {
  const { save } = useAgentActions(agent)
  const id = useId()
  const [draft, setDraft] = useState('')
  const policyRules = new Set(policies.map((p) => p.rule))
  const custom = agent.guardrails.filter((g) => !policyRules.has(g))

  const add = () => {
    const rule = draft.trim()
    if (!rule || agent.guardrails.includes(rule)) return
    save({ guardrails: [...agent.guardrails, rule] }, { title: 'Guardrail added' })
    setDraft('')
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-12">
      <section>
        <SectionHeader title="Rules" description="Plain-language limits the agent never crosses." />
        <ul className="flex flex-col gap-2">
          {custom.map((g) => (
            <li key={g} className="group flex items-center gap-3 rounded-card border border-line bg-white/[0.02] py-2 pl-4 pr-2">
              <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden />
              <span className="min-w-0 flex-1 text-[14px]">{g}</span>
              <Button size="sm" variant="ghost" iconOnly aria-label={`Remove rule: ${g}`} onClick={() => save({ guardrails: agent.guardrails.filter((x) => x !== g) }, { title: 'Guardrail removed' })}>
                <X />
              </Button>
            </li>
          ))}
          {custom.length === 0 && <li className="rounded-card border border-dashed border-line-strong px-4 py-5 text-center text-[13px] text-fg-muted">No custom rules yet.</li>}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <label htmlFor={id} className="sr-only">
            New guardrail
          </label>
          <Input id={id} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. Never promise a start date" />
          <Button type="submit" variant="secondary" leftIcon={<Plus />} disabled={!draft.trim()}>
            Add
          </Button>
        </form>
      </section>

      <section>
        <SectionHeader title="Policies" description="Workspace-grade protections for every conversation." />
        <ul className="surface divide-y divide-line overflow-hidden rounded-panel">
          {policies.map((p) => (
            <li key={p.rule} className="px-5 py-4">
              <Toggle
                label={p.rule}
                description={p.description}
                checked={agent.guardrails.includes(p.rule)}
                onChange={(v) =>
                  save({ guardrails: v ? [...agent.guardrails, p.rule] : agent.guardrails.filter((g) => g !== p.rule) }, { title: v ? 'Policy on' : 'Policy off', description: p.rule })
                }
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
