import { BookOpen, FileSpreadsheet, FileText, Globe, Presentation, ShieldCheck, Target, UserRound, Compass } from 'lucide-react'
import type { KnowledgeSource } from '@/types'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { EditableSection, ListEditor } from './EditableSection'
import type { BuilderConfig, SectionKey } from './templates'

export interface SectionProps {
  cfg: BuilderConfig
  update: (patch: Partial<BuilderConfig>, keys: SectionKey[]) => void
  flash: (k: SectionKey) => number
}

export function PurposeSection({ cfg, update, flash }: SectionProps) {
  return (
    <EditableSection
      id="sec-purpose"
      title="Purpose"
      icon={Compass}
      flashKey={flash('purpose')}
      value={{ purpose: cfg.purpose, personality: cfg.personality }}
      onSave={(v) => update(v, ['purpose'])}
      renderView={(v) => (
        <div>
          <p className="font-display text-[19px] font-medium leading-snug tracking-[-0.015em] text-fg sm:text-[21px]">{v.purpose}</p>
          <p className="mt-3 text-[13px] text-fg-muted">
            <span className="text-fg-subtle">Personality · </span>
            {v.personality}
          </p>
        </div>
      )}
      renderEdit={(d, set) => (
        <div className="flex flex-col gap-4">
          <Field label="Purpose" htmlFor="ed-purpose">
            <Textarea id="ed-purpose" value={d.purpose} onChange={(e) => set({ ...d, purpose: e.target.value })} className="min-h-24" />
          </Field>
          <Field label="Personality" htmlFor="ed-personality">
            <Input id="ed-personality" value={d.personality} onChange={(e) => set({ ...d, personality: e.target.value })} />
          </Field>
        </div>
      )}
    />
  )
}

export function CallerSection({ cfg, update, flash }: SectionProps) {
  return (
    <EditableSection
      id="sec-caller"
      title="Caller"
      icon={UserRound}
      flashKey={flash('caller')}
      value={cfg.caller}
      onSave={(caller) => update({ caller }, ['caller'])}
      renderView={(v) => (
        <div>
          <p className="text-[15px] leading-relaxed text-fg">{v}</p>
          <p className="mt-2 text-[12px] text-fg-subtle">Who the agent talks to</p>
        </div>
      )}
      renderEdit={(d, set) => (
        <Field label="Who calls this agent?" htmlFor="ed-caller">
          <Input id="ed-caller" value={d} onChange={(e) => set(e.target.value)} />
        </Field>
      )}
    />
  )
}

function BulletList({ items, icon: Icon, tone }: { items: string[]; icon: typeof Target; tone: string }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((g, i) => (
        <li key={`${g}-${i}`} className="flex animate-fade-up gap-2.5 text-[14px] leading-snug text-fg" style={{ animationDelay: `${i * 70}ms` }}>
          <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} aria-hidden />
          {g}
        </li>
      ))}
    </ul>
  )
}

export function GoalsSection({ cfg, update, flash }: SectionProps) {
  return (
    <EditableSection
      id="sec-goals"
      title="Goals"
      icon={Target}
      flashKey={flash('goals')}
      value={cfg.goals}
      onSave={(goals) => update({ goals: goals.map((g) => g.trim()).filter(Boolean) }, ['goals'])}
      renderView={(v) => <BulletList items={v} icon={Target} tone="text-accent" />}
      renderEdit={(d, set) => <ListEditor items={d} onChange={set} label="Goal" placeholder="What should the agent achieve?" />}
    />
  )
}

export function GuardrailsSection({ cfg, update, flash }: SectionProps) {
  return (
    <EditableSection
      id="sec-guardrails"
      title="Guardrails"
      icon={ShieldCheck}
      flashKey={flash('guardrails')}
      value={cfg.guardrails}
      onSave={(guardrails) => update({ guardrails: guardrails.map((g) => g.trim()).filter(Boolean) }, ['guardrails'])}
      renderView={(v) => <BulletList items={v} icon={ShieldCheck} tone="text-success" />}
      renderEdit={(d, set) => <ListEditor items={d} onChange={set} label="Guardrail" placeholder="Something the agent must never do" />}
    />
  )
}

const typeIcon: Record<KnowledgeSource['type'], typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  txt: FileText,
  pptx: Presentation,
  csv: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  url: Globe,
}

const guessType = (name: string): KnowledgeSource['type'] => {
  const n = name.toLowerCase()
  if (/https?:|www\.|\.com|\.io|website|page|site/.test(n)) return 'url'
  const ext = n.match(/\.(pdf|docx|pptx|txt|csv|xlsx)$/)?.[1] as KnowledgeSource['type'] | undefined
  return ext ?? 'pdf'
}

export function KnowledgeSection({ cfg, update, flash }: SectionProps) {
  return (
    <EditableSection
      id="sec-knowledge"
      title="Knowledge"
      icon={BookOpen}
      flashKey={flash('knowledge')}
      value={cfg.knowledge.map((k) => k.name)}
      onSave={(names) => {
        const clean = names.map((n) => n.trim()).filter(Boolean)
        update({ knowledge: clean.map((name) => cfg.knowledge.find((k) => k.name === name) ?? { name, type: guessType(name) }) }, ['knowledge'])
      }}
      renderView={() => (
        <div>
          <p className="mb-3 text-[13px] text-fg-muted">Suggested sources for this agent</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {cfg.knowledge.map((k, i) => {
              const Icon = typeIcon[k.type]
              return (
                <li
                  key={k.name}
                  className="flex animate-fade-up items-center gap-3 rounded-[12px] border border-dashed border-line-strong bg-white/[0.015] px-3 py-2.5"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-white/[0.04] text-fg-muted">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-fg">{k.name}</span>
                    <span className="block text-[11px] uppercase tracking-wider text-fg-subtle">{k.type === 'url' ? 'Website' : k.type}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      renderEdit={(d, set) => <ListEditor items={d} onChange={set} label="Source" placeholder="e.g. Pricing sheet.pdf or yoursite.com/faq" />}
      hint="Upload these documents from the agent’s Knowledge tab after it’s created — PDF, DOCX, PPTX, CSV, XLSX or a website URL."
    />
  )
}
