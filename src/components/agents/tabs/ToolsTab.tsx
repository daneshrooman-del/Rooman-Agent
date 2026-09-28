import { useState } from 'react'
import { BookOpen, Calendar, Contact, Database, FileSignature, Headset, Mail, MessageSquare, Plus, Plug, Receipt, Ticket, Webhook, type LucideIcon } from 'lucide-react'
import type { Agent, AgentTool } from '@/types'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Toggle } from '@/components/ui/Form'
import { SectionHeader } from '@/components/ui/PageHeader'
import { useAgentActions } from '../useAgentActions'

const icons: Record<string, LucideIcon> = {
  t_kb: BookOpen, t_cal: Calendar, t_crm: Contact, t_email: Mail, t_ats: Database, t_handoff: Headset,
  t_slack: MessageSquare, t_sheets: Database, t_hook: Webhook, t_sign: FileSignature, t_pay: Receipt, t_ticket: Ticket,
}

const catalog: Omit<AgentTool, 'enabled'>[] = [
  { id: 't_kb', name: 'Knowledge search', description: 'Look up answers in connected documents' },
  { id: 't_cal', name: 'Calendar', description: 'Check availability and schedule meetings' },
  { id: 't_crm', name: 'CRM', description: 'Read and update contact records' },
  { id: 't_email', name: 'Email', description: 'Send follow-ups and summaries' },
  { id: 't_ats', name: 'Applicant tracking', description: 'Search candidates and update pipeline stages' },
  { id: 't_handoff', name: 'Human handoff', description: 'Transfer to a person when needed' },
  { id: 't_slack', name: 'Slack', description: 'Notify a channel when a conversation needs attention' },
  { id: 't_sheets', name: 'Google Sheets', description: 'Read and append rows to a spreadsheet' },
  { id: 't_hook', name: 'Webhook', description: 'Call your own endpoint with conversation data' },
  { id: 't_sign', name: 'E-signature', description: 'Send offer letters and agreements for signature' },
  { id: 't_ticket', name: 'Helpdesk', description: 'Create and update support tickets' },
]

export function ToolsTab({ agent }: { agent: Agent }) {
  const { save } = useAgentActions(agent)
  const [open, setOpen] = useState(false)
  const available = catalog.filter((c) => !agent.tools.some((t) => t.id === c.id))
  const enabled = agent.tools.filter((t) => t.enabled).length

  const setTools = (tools: AgentTool[], title: string) => save({ tools }, { title })

  return (
    <div className="max-w-3xl">
      <SectionHeader
        title="Tools"
        description={`${enabled} of ${agent.tools.length} tools enabled. The agent only uses tools you switch on.`}
        action={
          <Button size="sm" variant="secondary" leftIcon={<Plug />} onClick={() => setOpen(true)}>
            Connect a tool
          </Button>
        }
      />
      <ul className="surface divide-y divide-line overflow-hidden rounded-panel">
        {agent.tools.map((t) => {
          const Icon = icons[t.id] ?? Plug
          return (
            <li key={t.id} className="flex items-center gap-4 px-5 py-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] border border-line-strong bg-white/[0.04] text-fg-muted">
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <Toggle
                  label={t.name}
                  description={t.description}
                  checked={t.enabled}
                  onChange={(v) => setTools(agent.tools.map((x) => (x.id === t.id ? { ...x, enabled: v } : x)), `${t.name} ${v ? 'enabled' : 'disabled'}`)}
                />
              </div>
            </li>
          )
        })}
      </ul>

      <Dialog open={open} onClose={() => setOpen(false)} title="Connect a tool" description="Give the agent new abilities. Connected tools start enabled.">
        {available.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-fg-muted">Every available tool is already connected.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {available.map((c) => {
              const Icon = icons[c.id] ?? Plug
              return (
                <li key={c.id} className="flex items-center gap-3 rounded-card border border-line p-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-line-strong bg-white/[0.04] text-fg-muted">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium">{c.name}</p>
                    <p className="text-[12px] text-fg-muted">{c.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<Plus />}
                    aria-label={`Connect ${c.name}`}
                    onClick={() => setTools([...agent.tools, { ...c, enabled: true }], `${c.name} connected`)}
                  >
                    Connect
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </Dialog>
    </div>
  )
}
