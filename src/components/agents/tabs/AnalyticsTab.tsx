import { useMemo } from 'react'
import { BarChart3, Radio } from 'lucide-react'
import type { Agent } from '@/types'
import { formatDuration, formatNumber } from '@/lib/format'
import { useWorkspace } from '@/state/workspace'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/PageHeader'
import { DemoNote, EmptyState } from '@/components/ui/States'
import { ConversationBars, type DayPoint } from '../ConversationBars'

const intentsById: Record<string, string[]> = {
  ag_hr: ['Open a new role', 'Shortlist status', 'Schedule interviews', 'Salary band question', 'Compliance question'],
  ag_sales: ['Pricing question', 'Book a demo', 'Integration question', 'Compare plans', 'Talk to sales'],
  ag_support: ['Login issue', 'Billing question', 'Feature how-to', 'Bug report', 'Cancel subscription'],
}

/** Deterministic demo series derived from the agent's own stats. */
function series(agent: Agent): DayPoint[] {
  const avg = Math.max(1, agent.stats.conversations / 30)
  const seed = agent.id.length
  const today = new Date()
  return Array.from({ length: 14 }, (_, i) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (13 - i))
    const weekend = date.getDay() === 0 || date.getDay() === 6 ? 0.55 : 1
    const wave = 0.82 + 0.22 * Math.sin(i * 0.9 + seed) + i * 0.018
    const value = i === 13 && agent.stats.activeToday ? agent.stats.activeToday : Math.round(avg * wave * weekend)
    return { date, value }
  })
}

export function AnalyticsTab({ agent, onTest }: { agent: Agent; onTest: () => void }) {
  const { isDemo } = useWorkspace()
  const points = useMemo(() => series(agent), [agent])
  const s = agent.stats

  if (s.conversations === 0) {
    return (
      <EmptyState
        icon={<BarChart3 />}
        title="No conversations yet"
        description="Analytics appear once the agent starts talking to people. Run a live test or deploy it to a channel."
        action={
          <Button variant="secondary" leftIcon={<Radio />} onClick={onTest}>
            Test the agent
          </Button>
        }
      />
    )
  }

  const handoffs = Math.round(s.conversations * ((100 - s.completionRate) / 100) * 0.45)
  const last14 = points.reduce((t, p) => t + p.value, 0)
  const intents = intentsById[agent.id] ?? agent.workflow.filter((n) => n.kind !== 'start').map((n) => n.label).slice(0, 5)
  const weights = [0.34, 0.24, 0.18, 0.14, 0.1]
  const metrics = [
    { label: 'Conversations', value: formatNumber(s.conversations), sub: `${formatNumber(last14)} in the last 14 days` },
    { label: 'Completion rate', value: `${s.completionRate}%`, sub: 'Goal reached without a person' },
    { label: 'Avg duration', value: formatDuration(s.avgDurationSec), sub: 'per conversation' },
    { label: 'Handoffs', value: formatNumber(handoffs), sub: `${Math.round((handoffs / s.conversations) * 100)}% routed to your team` },
  ]

  return (
    <div className="flex flex-col gap-10">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-y border-line py-6 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="min-w-0">
            <dt className="text-[12px] text-fg-subtle">{m.label}</dt>
            <dd className="tabular mt-1 text-[28px] font-semibold leading-none tracking-[-0.02em] sm:text-[32px]">{m.value}</dd>
            <dd className="mt-1.5 text-[12px] text-fg-subtle">{m.sub}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <section>
          <SectionHeader title="Conversations" description="Last 14 days" />
          <ConversationBars points={points} label={`${agent.name} conversations per day, last 14 days`} />
        </section>
        <section>
          <SectionHeader title="Top intents" description="Why people reach this agent" />
          <ol className="flex flex-col gap-4">
            {intents.map((name, i) => {
              const pct = Math.round(weights[i] * 100)
              return (
                <li key={name}>
                  <div className="flex items-baseline justify-between gap-3 text-[14px]">
                    <span className="truncate text-fg">{name}</span>
                    <span className="tabular text-[13px] text-fg-muted">{pct}%</span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${(weights[i] / weights[0]) * 100}%`, opacity: 1 - i * 0.14 }} />
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      </div>
      {isDemo && <DemoNote>Sample analytics derived from demo stats — connect your backend for real conversation data.</DemoNote>}
    </div>
  )
}
