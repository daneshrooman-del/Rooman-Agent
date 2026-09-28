import { Activity, CircleCheckBig, Radio } from 'lucide-react'
import type { Agent } from '@/types'
import { formatNumber } from '@/lib/format'
import { StatusDot } from '@/components/ui/StatusIndicator'

/** One calm band that summarises the AI workforce — not a row of stat cards. */
export function WorkforceSummary({ agents }: { agents: Agent[] }) {
  const live = agents.filter((a) => a.status === 'live').length
  const today = agents.reduce((s, a) => s + a.stats.activeToday, 0)
  const withStats = agents.filter((a) => a.stats.conversations > 0)
  const total = withStats.reduce((s, a) => s + a.stats.conversations, 0)
  const avg = total ? Math.round(withStats.reduce((s, a) => s + a.stats.completionRate * a.stats.conversations, 0) / total) : 0

  const items = [
    { icon: Radio, label: 'Live agents', value: `${live}`, sub: `of ${agents.length} in your workforce`, dot: live > 0 },
    { icon: Activity, label: 'Conversations today', value: formatNumber(today), sub: `${formatNumber(total)} all time` },
    { icon: CircleCheckBig, label: 'Avg completion', value: avg ? `${avg}%` : '—', sub: 'weighted by conversations' },
  ]

  return (
    <section aria-label="Workforce summary" className="surface grid grid-cols-3 divide-x divide-line overflow-hidden rounded-panel">
      {items.map((it, i) => (
        <div key={it.label} className="flex animate-fade-up items-center gap-4 px-3.5 py-4 sm:px-6 sm:py-5" style={{ animationDelay: `${i * 70}ms` }}>
          <span className="hidden size-10 shrink-0 sm:flex items-center justify-center rounded-[12px] border border-line-strong bg-white/[0.04] text-fg-muted">
            <it.icon className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] leading-tight text-fg-subtle sm:gap-2 sm:text-[12px]">
              {it.dot && <StatusDot status="live" />}
              {it.label}
            </p>
            <p className="tabular mt-0.5 text-[22px] font-semibold leading-tight sm:text-[24px] tracking-tight">{it.value}</p>
            <p className="hidden truncate text-[12px] text-fg-subtle sm:block">{it.sub}</p>
          </div>
        </div>
      ))}
    </section>
  )
}
