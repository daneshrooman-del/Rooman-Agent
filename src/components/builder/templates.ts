/* Deterministic agent templates for the conversational Agent Builder.
   Intent is detected from keywords; refinements are simple keyword rules. */
import type { Agent, AgentStatus, AgentTool, Channel, KnowledgeSource, WorkflowNode } from '@/types'

export type TemplateKind = 'hr' | 'sales' | 'support' | 'custom'

export interface BuilderConfig {
  kind: TemplateKind
  name: string
  purpose: string
  personality: string
  caller: string
  goals: string[]
  workflow: WorkflowNode[]
  knowledge: { name: string; type: KnowledgeSource['type'] }[]
  tools: AgentTool[]
  guardrails: string[]
  avatarId: string
  voiceId: string
  languages: string[]
  channels: Channel[]
}

export type SectionKey =
  | 'purpose'
  | 'caller'
  | 'goals'
  | 'workflow'
  | 'knowledge'
  | 'tools'
  | 'guardrails'
  | 'avatar'
  | 'voice'
  | 'languages'
  | 'channels'

export const TOOL_CATALOG: Omit<AgentTool, 'enabled'>[] = [
  { id: 't_kb', name: 'Knowledge search', description: 'Look up answers in connected documents' },
  { id: 't_cal', name: 'Calendar', description: 'Check availability and schedule meetings' },
  { id: 't_crm', name: 'CRM', description: 'Read and update contact records' },
  { id: 't_email', name: 'Email', description: 'Send follow-ups and summaries' },
  { id: 't_ats', name: 'Applicant tracking', description: 'Search candidates and update pipeline stages' },
  { id: 't_handoff', name: 'Human handoff', description: 'Transfer to a person when needed' },
]

export const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Marathi', 'Bengali', 'Spanish', 'French', 'German', 'Arabic']
export const CHANNEL_ORDER: Channel[] = ['phone', 'web', 'api', 'video', 'whatsapp']

const tools = (on: string[]): AgentTool[] => TOOL_CATALOG.map((t) => ({ ...t, enabled: on.includes(t.id) }))

export const EXAMPLE_PROMPTS: { label: string; text: string }[] = [
  {
    label: 'HR placement',
    text: 'I need an agent that receives calls from HR teams, understands job and candidate requirements, communicates with them, and helps complete the placement process.',
  },
  {
    label: 'Sales',
    text: 'Build a sales agent that qualifies inbound leads from our website, answers product questions and books demos with the right account executive.',
  },
  {
    label: 'Support',
    text: 'Create a customer support agent that resolves common product issues over video chat, collects diagnostics and escalates anything complex to our support team.',
  },
]

export function detectKind(text: string): TemplateKind {
  const t = text.toLowerCase()
  if (/\b(hr|placement|placements|candidate|candidates|recruit\w*|hiring|job)\b/.test(t)) return 'hr'
  if (/\b(sales|lead|leads|demo|demos|prospect\w*|pipeline)\b/.test(t)) return 'sales'
  if (/\b(support|customer|customers|issue|issues|ticket\w*|helpdesk)\b/.test(t)) return 'support'
  return 'custom'
}

export interface TemplateCopy {
  ack: string
  plan: string[]
}

export function templateCopy(kind: TemplateKind, name: string): TemplateCopy {
  switch (kind) {
    case 'hr':
      return {
        ack: "I understand. I'll create an HR placement agent.",
        plan: [
          'Greet HR teams and capture the role, urgency and hiring manager',
          'Collect job details and search your candidate pool',
          'Share a shortlist, then schedule interviews or hand off to a recruiter',
        ],
      }
    case 'sales':
      return {
        ack: "Got it. I'll create a sales agent that qualifies leads and books demos.",
        plan: ['Discover the prospect’s need and qualify the lead', 'Answer product questions from your brochure and pricing', 'Book a demo with the right account executive'],
      }
    case 'support':
      return {
        ack: "Understood. I'll create a customer support agent.",
        plan: ['Identify the customer and their issue', 'Resolve it from your help center, collecting diagnostics', 'Escalate with full context when it can’t be solved'],
      }
    default:
      return {
        ack: `I understand. I'll create ${name}, tailored to what you described.`,
        plan: ['Understand the request and what the caller needs', 'Complete the task using your knowledge and tools', 'Confirm next steps or hand off to a person'],
      }
  }
}

function sentenceCase(s: string) {
  const t = s.trim().replace(/\s+/g, ' ')
  return t ? t[0].toUpperCase() + t.slice(1) : t
}

/** Derive a purpose sentence from free text: "I need an agent that X" → "X." */
function derivePurpose(text: string) {
  const cleaned = text
    .trim()
    .replace(/^(please\s+)?(i\s+(need|want|would like)|build|create|make|can you (build|create|make))\s+(me\s+)?(an?\s+)?(ai\s+)?(agent|assistant|bot)?\s*(that|which|to|who|for)?\s*/i, '')
    .replace(/[.!?]+$/, '')
  const first = cleaned.split(/(?<=[.!?])\s/)[0]
  return first ? `${sentenceCase(first).slice(0, 220)}.` : 'Handles requests on your behalf and completes the task end to end.'
}

export function buildConfig(text: string, avatar: { id: string; voiceId: string }): BuilderConfig {
  const kind = detectKind(text)
  const base = { avatarId: avatar.id, voiceId: avatar.voiceId }
  switch (kind) {
    case 'hr':
      return {
        ...base,
        kind,
        name: 'HR Placement Agent',
        purpose: 'Receives calls from HR teams, understands job and candidate requirements, and helps complete the placement process.',
        personality: 'Professional, warm and concise. Asks one question at a time.',
        caller: 'HR teams and hiring managers at client companies',
        goals: ['Capture complete job requirements', 'Match and shortlist suitable candidates', 'Keep HR teams updated on candidate status', 'Schedule interviews or hand off to a recruiter'],
        workflow: [
          { id: 'n1', label: 'Start', kind: 'start', description: 'Inbound call from an HR team' },
          { id: 'n2', label: 'Understand HR requirement', kind: 'step', description: 'Role, urgency and hiring manager' },
          { id: 'n3', label: 'Collect job details', kind: 'step', description: 'Skills, experience, location, budget' },
          { id: 'n4', label: 'Search candidate knowledge', kind: 'tool', description: 'Query the candidate pool and open roles' },
          { id: 'n5', label: 'Check candidate match', kind: 'decision', description: 'Score candidates against requirements' },
          { id: 'n6', label: 'Communicate result', kind: 'step', description: 'Share shortlist and next steps' },
          { id: 'n7', label: 'Complete placement / Human handoff', kind: 'handoff', description: 'Schedule interviews or route to a recruiter' },
        ],
        knowledge: [
          { name: 'Placement process handbook', type: 'pdf' },
          { name: 'Open roles & job descriptions', type: 'xlsx' },
          { name: 'Candidate pool export', type: 'csv' },
          { name: 'Careers page', type: 'url' },
        ],
        tools: tools(['t_kb', 't_cal', 't_ats', 't_email', 't_handoff']),
        guardrails: ['Never share candidate personal contact details', 'Do not commit to salary figures', 'Escalate legal or compliance questions to a human'],
        languages: ['English'],
        channels: ['phone', 'web'],
      }
    case 'sales':
      return {
        ...base,
        kind,
        name: 'Sales Agent',
        purpose: 'Qualifies inbound leads, answers product questions and books demos with the right account executive.',
        personality: 'Energetic and consultative, never pushy.',
        caller: 'Prospective customers from the website and campaigns',
        goals: ['Qualify budget, authority, need and timeline', 'Answer product questions accurately', 'Book a demo with the right account executive'],
        workflow: [
          { id: 'n1', label: 'Start', kind: 'start', description: 'Visitor starts a conversation' },
          { id: 'n2', label: 'Greet & discover need', kind: 'step', description: 'Understand what they want to solve' },
          { id: 'n3', label: 'Qualify lead', kind: 'decision', description: 'Budget, authority, need, timeline' },
          { id: 'n4', label: 'Answer product questions', kind: 'tool', description: 'Search brochure and pricing' },
          { id: 'n5', label: 'Update CRM', kind: 'tool', description: 'Log the lead and conversation' },
          { id: 'n6', label: 'Book demo', kind: 'end', description: 'Schedule with an account executive' },
        ],
        knowledge: [
          { name: 'Product brochure', type: 'pdf' },
          { name: 'Pricing & plans', type: 'docx' },
          { name: 'Customer case studies', type: 'pptx' },
          { name: 'Product website', type: 'url' },
        ],
        tools: tools(['t_kb', 't_cal', 't_crm', 't_email']),
        guardrails: ['Do not offer discounts', 'Do not make roadmap promises', 'Never pressure a prospect to commit'],
        languages: ['English'],
        channels: ['web', 'whatsapp'],
      }
    case 'support':
      return {
        ...base,
        kind,
        name: 'Customer Support Agent',
        purpose: 'Resolves common customer issues on first contact and escalates the rest with full context.',
        personality: 'Patient, clear and reassuring.',
        caller: 'Existing customers',
        goals: ['Resolve common issues on first contact', 'Collect diagnostics', 'Escalate with full context'],
        workflow: [
          { id: 'n1', label: 'Start', kind: 'start', description: 'Customer reaches out' },
          { id: 'n2', label: 'Identify customer & issue', kind: 'step', description: 'Verify account and understand the problem' },
          { id: 'n3', label: 'Search help center', kind: 'tool', description: 'Find the documented fix' },
          { id: 'n4', label: 'Resolved?', kind: 'decision', description: 'Confirm the fix worked' },
          { id: 'n5', label: 'Escalate to support team', kind: 'handoff', description: 'Hand off with a full summary' },
        ],
        knowledge: [
          { name: 'Help center articles', type: 'url' },
          { name: 'Troubleshooting guide', type: 'pdf' },
          { name: 'Known issues log', type: 'csv' },
        ],
        tools: tools(['t_kb', 't_crm', 't_email', 't_handoff']),
        guardrails: ['Never ask for passwords or card numbers', 'Escalate billing disputes to a human', 'Do not promise refunds'],
        languages: ['English'],
        channels: ['web', 'video'],
      }
    default:
      return {
        ...base,
        kind,
        name: 'Custom Agent',
        purpose: derivePurpose(text),
        personality: 'Helpful, clear and professional.',
        caller: 'Customers and team members who reach out',
        goals: ['Understand what the caller needs', 'Complete the task accurately', 'Hand off to a person when unsure'],
        workflow: [
          { id: 'n1', label: 'Start', kind: 'start', description: 'Conversation begins' },
          { id: 'n2', label: 'Understand request', kind: 'step', description: 'Clarify intent and details' },
          { id: 'n3', label: 'Look up knowledge', kind: 'tool', description: 'Search connected sources' },
          { id: 'n4', label: 'Can it be completed?', kind: 'decision' },
          { id: 'n5', label: 'Complete or hand off', kind: 'handoff', description: 'Confirm next steps' },
        ],
        knowledge: [
          { name: 'Company FAQ', type: 'docx' },
          { name: 'Website', type: 'url' },
        ],
        tools: tools(['t_kb', 't_email', 't_handoff']),
        guardrails: ['Do not share internal or personal data', 'Escalate anything outside scope to a human'],
        languages: ['English'],
        channels: ['web'],
      }
  }
}

/* ---------------------------------------------------------------- refinement */

export interface Refinement {
  config: BuilderConfig
  changed: SectionKey[]
  reply: string
}

const CHANNEL_WORDS: [RegExp, Channel][] = [
  [/\bwhats\s?app\b/, 'whatsapp'],
  [/\b(phone|calls?|telephone)\b/, 'phone'],
  [/\b(web|website|widget|chat widget)\b/, 'web'],
  [/\bapi\b/, 'api'],
  [/\bvideo\b/, 'video'],
]

const TOOL_WORDS: [RegExp, string][] = [
  [/\bcalendar|schedul\w*|booking\b/, 't_cal'],
  [/\bcrm|salesforce|hubspot\b/, 't_crm'],
  [/\bemail|e-mail|mail\b/, 't_email'],
  [/\bats|applicant/, 't_ats'],
  [/\bhandoff|hand off|human|escalat\w*/, 't_handoff'],
  [/\bknowledge|search\b/, 't_kb'],
]

const joinList = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

export function refineConfig(cfg: BuilderConfig, text: string): Refinement {
  const t = text.toLowerCase()
  const negative = /\b(remove|drop|disable|without|stop|no longer|don'?t|turn off)\b/.test(t)
  let next: BuilderConfig = { ...cfg }
  const changed = new Set<SectionKey>()
  const notes: string[] = []

  // name change
  const nameMatch = text.match(/\b(?:call it|name it|rename (?:it )?to|rename to|name (?:the agent|this agent|it) to|call the agent)\s+["“']?([^"”'.!?\n]{2,48})/i)
  if (nameMatch) {
    const name = sentenceCase(nameMatch[1].replace(/\s+(please|instead)$/i, ''))
    next.name = name
    notes.push(`renamed the agent to “${name}”`)
  }

  // languages
  const langs = LANGUAGE_OPTIONS.filter((l) => new RegExp(`\\b${l.toLowerCase()}\\b`).test(t))
  if (langs.length && !nameMatch) {
    if (negative) {
      const remaining = next.languages.filter((l) => !langs.includes(l))
      next.languages = remaining.length ? remaining : ['English']
      notes.push(`removed ${joinList(langs)}`)
    } else {
      next.languages = Array.from(new Set([...next.languages, ...langs]))
      notes.push(`added ${joinList(langs)} as ${langs.length > 1 ? 'languages' : 'a language'}`)
    }
    changed.add('languages')
  }

  // tools
  const toolIds = TOOL_WORDS.filter(([re]) => re.test(t)).map(([, id]) => id)
  const mentionsTool = /\btools?\b|\bintegrat\w*|\bconnect\b/.test(t)
  if (toolIds.length && (mentionsTool || /\b(add|enable|use|remove|disable|drop)\b/.test(t))) {
    next.tools = next.tools.map((tool) => (toolIds.includes(tool.id) ? { ...tool, enabled: !negative } : tool))
    const names = next.tools.filter((x) => toolIds.includes(x.id)).map((x) => x.name)
    notes.push(`${negative ? 'disabled' : 'enabled'} the ${joinList(names)} tool${names.length > 1 ? 's' : ''}`)
    changed.add('tools')
  } else if (mentionsTool && !negative) {
    const m = text.match(/\b(?:add|use|connect|enable)\s+(?:an?\s+|the\s+)?([a-z0-9 -]{2,32}?)\s+(?:tool|integration)\b/i)
    if (m) {
      const name = sentenceCase(m[1])
      next.tools = [...next.tools, { id: `t_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, name, description: `Custom ${name} integration`, enabled: true }]
      notes.push(`added a ${name} tool`)
      changed.add('tools')
    }
  }

  // channels
  const channelHits = CHANNEL_WORDS.filter(([re]) => re.test(t)).map(([, c]) => c)
  const channelIntent = /\b(channel|deploy|available|on|over|via|through|add|enable|remove|disable)\b/.test(t)
  const toolClaimedPhone = toolIds.length > 0 && channelHits.every((c) => c === 'video' || c === 'web')
  if (channelHits.length && channelIntent && !toolClaimedPhone && !nameMatch) {
    const uniq = Array.from(new Set(channelHits))
    next.channels = negative
      ? next.channels.filter((c) => !uniq.includes(c))
      : CHANNEL_ORDER.filter((c) => next.channels.includes(c) || uniq.includes(c))
    if (!next.channels.length) next.channels = ['web']
    notes.push(`${negative ? 'removed' : 'added'} ${joinList(uniq.map(channelLabel))} ${negative ? 'from' : 'as'} ${uniq.length > 1 ? 'channels' : 'a channel'}`)
    changed.add('channels')
  }

  if (!notes.length) {
    const goal = sentenceCase(text.replace(/^(also|and|please|can you|could you|make sure (it|the agent)?)\s+/i, '').replace(/[.!?]+$/, ''))
    next = { ...next, goals: [...next.goals, goal] }
    changed.add('goals')
    return { config: next, changed: [...changed], reply: `Noted. I've added “${goal}” as a goal and will factor it into the conversation flow.` }
  }

  const summary = notes.join(', ')
  return { config: next, changed: [...changed], reply: `Done — I've ${summary}. You can see the update on the right.` }
}

const channelLabel = (c: Channel) => ({ phone: 'Phone', web: 'Web', api: 'API', video: 'Video', whatsapp: 'WhatsApp' })[c]

/* ---------------------------------------------------------------- live import */

export interface FromLive {
  avatarId?: string
  personality?: string
  goals?: string[]
  transcript?: string | { role?: string; text?: string; content?: string }[]
}

export function transcriptText(t: FromLive['transcript']): string {
  if (!t) return ''
  if (typeof t === 'string') return t
  return t.map((m) => m.text ?? m.content ?? '').join(' ')
}

/* ---------------------------------------------------------------- final agent */

export function toAgent(cfg: BuilderConfig, status: AgentStatus): Agent {
  const at = new Date().toISOString()
  const id = `ag_${Date.now().toString(36)}`
  return {
    id,
    name: cfg.name.trim() || 'Untitled Agent',
    status,
    avatarId: cfg.avatarId,
    voiceId: cfg.voiceId,
    purpose: cfg.purpose,
    caller: cfg.caller,
    goals: cfg.goals.filter(Boolean),
    personality: cfg.personality,
    guardrails: cfg.guardrails.filter(Boolean),
    languages: cfg.languages,
    channels: cfg.channels,
    tools: cfg.tools,
    knowledge: [],
    workflow: cfg.workflow,
    stats: { conversations: 0, completionRate: 0, activeToday: 0, avgDurationSec: 0 },
    createdAt: at,
    updatedAt: at,
    activity: [
      ...(status === 'live' ? [{ id: `${id}_d`, text: `Deployed to ${cfg.channels.map(channelLabel).join(', ')}`, at, kind: 'deploy' as const }] : []),
      { id: `${id}_c`, text: 'Created with Agent Builder', at, kind: 'edit' as const },
    ],
  }
}
