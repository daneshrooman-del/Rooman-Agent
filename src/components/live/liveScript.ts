/* Scripted demo replies for the Live AI page. Replies adapt to the
   session's configuration (knowledge, tools, goals, response style). */
import type { LiveEvent, Responder } from './types'

export type ResponseStyle = 'concise' | 'balanced' | 'detailed'

export interface LiveConfig {
  personality: string
  goals: string
  /** knowledge source names switched on for this session */
  knowledge: string[]
  /** tool names switched on for this session */
  tools: string[]
  language: string
  style: ResponseStyle
}

export const LIVE_VOICE_PROMPTS = [
  'Tell me about your company.',
  'How could an AI agent help my team?',
  'Can you book a demo for next week?',
  'What does it cost to get started?',
]

interface Topic {
  match: RegExp
  knowledge?: boolean
  tool?: RegExp
  lines: [string, string, string]
}

const topics: Topic[] = [
  {
    match: /company|about you|what do you do|who are you|business/,
    knowledge: true,
    lines: [
      'We help businesses turn one real person into an AI avatar they can use everywhere.',
      'That same avatar presents your videos, talks to customers live like I’m doing now, and powers AI agents that handle calls and requests around the clock.',
      'Teams usually start with a few videos, then add a live assistant, and finally hand repeat workflows — like HR intake or sales qualification — to an agent.',
    ],
  },
  {
    match: /agent|automate|team|workflow/,
    knowledge: true,
    lines: [
      'An agent is me, plus a job to do.',
      'You give it goals, your documents and a few tools — calendar, CRM, applicant tracking — and it follows a workflow you design, handing off to a person whenever it should.',
      'For example, an HR placement agent can capture a job requirement, search your candidate pool, share a shortlist and book interviews.',
    ],
  },
  {
    match: /book|demo|schedule|meeting|call me|calendar/,
    tool: /calendar/i,
    lines: [
      'Sure — I can offer Tuesday at 11:00 or Thursday at 15:30.',
      'I’ll send a calendar invite with a short agenda so the right people from your side can join.',
      'If neither works, tell me a better time and I’ll check again.',
    ],
  },
  {
    match: /price|pricing|cost|plan|expensive/,
    knowledge: true,
    lines: [
      'Plans are based on video minutes, live minutes and agent conversations.',
      'Most teams start on Pro, which includes credits for all three, and scale up once an agent goes live.',
      'I’m not able to quote a custom price here, but I can connect you with our team for one.',
    ],
  },
  {
    match: /video/,
    knowledge: true,
    lines: [
      'You write what I should say, pick an action and a scene, and I record it for you.',
      'The same face and voice stay consistent across every video, in several languages.',
      'Most videos render in a few minutes.',
    ],
  },
  {
    match: /^(hi|hello|hey)\b|can you hear/,
    lines: ['Hi! Yes, I can hear you clearly.', 'Ask me anything — about our company, what agents can do, or how to get started.', ''],
  },
]

function compose(lines: string[], style: ResponseStyle) {
  const n = style === 'concise' ? 1 : style === 'balanced' ? 2 : 3
  return lines.slice(0, n).filter(Boolean).join(' ')
}

export function createLiveResponder(getConfig: () => LiveConfig & { avatarName: string }): Responder {
  return (input) => {
    const cfg = getConfig()
    const t = input.toLowerCase()
    const topic = topics.find((x) => x.match.test(t))
    const events: LiveEvent[] = []
    const goal = cfg.goals.split('\n').map((g) => g.trim()).find(Boolean)

    if (!topic) {
      events.push({ kind: 'response', detail: goal ? `Goal: ${goal}` : `Style: ${cfg.style}` })
      return {
        events,
        text: compose(
          [
            'Good question.',
            `I’m ${cfg.avatarName}’s live assistant, so I’m best at explaining what we do and helping you get started.`,
            'Could you tell me a little more about what you’re looking for?',
          ],
          cfg.style === 'concise' ? 'balanced' : cfg.style,
        ),
      }
    }

    if (topic.knowledge && cfg.knowledge[0]) events.push({ kind: 'knowledge', detail: cfg.knowledge[0] })
    if (topic.tool) {
      const tool = cfg.tools.find((n) => topic.tool!.test(n))
      if (!tool) {
        events.push({ kind: 'response', detail: 'Calendar tool is off' })
        return { events, text: 'I’d love to, but I don’t have calendar access in this session. Switch on the Calendar tool in Agent configuration and ask me again.' }
      }
      events.push({ kind: 'tool', detail: tool })
    }
    events.push({ kind: 'response', detail: goal ? `Goal: ${goal}` : `Style: ${cfg.style}` })
    return { events, text: compose(topic.lines, cfg.style) }
  }
}
