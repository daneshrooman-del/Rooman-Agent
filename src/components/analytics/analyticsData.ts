import type { UsagePoint } from '@/types'

export type Period = '7d' | '30d' | '6m'

export const periodLabel: Record<Period, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '6m': 'Last 6 months',
}
export const previousLabel: Record<Period, string> = {
  '7d': 'vs previous 7 days',
  '30d': 'vs previous 30 days',
  '6m': 'vs previous 6 months',
}

export type SeriesKey = 'videos' | 'liveMinutes' | 'agentConversations'

/** Deterministic noise so demo charts are stable between renders. */
function noise(i: number) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Spread one month's total across 30 days with a gentle upward trend and
 * softer weekends, preserving the monthly total.
 */
function spreadMonth(total: number, endDate: Date, seed: number) {
  const weights = Array.from({ length: 30 }, (_, d) => {
    const date = new Date(endDate.getTime() - (29 - d) * 86_400_000)
    const weekend = date.getDay() === 0 || date.getDay() === 6 ? 0.72 : 1
    return (0.85 + (d / 29) * 0.3) * weekend * (0.8 + noise(seed + d) * 0.4)
  })
  const sum = weights.reduce((s, w) => s + w, 0)
  return weights.map((w) => (w / sum) * total)
}

function daily(usage: UsagePoint[]) {
  const last = usage[usage.length - 1]
  const prev = usage[usage.length - 2] ?? last
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const prevEnd = new Date(today.getTime() - 30 * 86_400_000)
  const keys: SeriesKey[] = ['videos', 'liveMinutes', 'agentConversations']
  const series = Object.fromEntries(
    keys.map((k, ki) => [k, [...spreadMonth(prev[k], prevEnd, ki * 100), ...spreadMonth(last[k], today, ki * 100 + 50)]]),
  ) as Record<SeriesKey, number[]>
  return Array.from({ length: 60 }, (_, i) => {
    const date = new Date(today.getTime() - (59 - i) * 86_400_000)
    return {
      date,
      videos: Math.round(series.videos[i]),
      liveMinutes: Math.round(series.liveMinutes[i]),
      agentConversations: Math.round(series.agentConversations[i]),
    }
  })
}

/** Current + previous period series derived from the workspace usage history. */
export function buildPeriod(usage: UsagePoint[], period: Period): { current: UsagePoint[]; previous: UsagePoint[] } {
  if (!usage.length) return { current: [], previous: [] }
  if (period === '6m') {
    // Earlier history isn't in the snapshot — estimate the previous half-year from the first month's run-rate.
    const base = usage[0]
    const previous = usage.map((u) => ({ ...u, videos: Math.round(base.videos * 0.8), liveMinutes: Math.round(base.liveMinutes * 0.8), agentConversations: Math.round(base.agentConversations * 0.8) }))
    return { current: usage, previous }
  }
  const days = daily(usage)
  const n = period === '7d' ? 7 : 30
  const fmt = (d: Date) =>
    period === '7d' ? d.toLocaleDateString('en', { weekday: 'short' }) : d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  const toPoint = (d: (typeof days)[number]): UsagePoint => ({ label: fmt(d.date), videos: d.videos, liveMinutes: d.liveMinutes, agentConversations: d.agentConversations })
  return { current: days.slice(-n).map(toPoint), previous: days.slice(-2 * n, -n).map(toPoint) }
}

export const sum = (list: UsagePoint[], key: SeriesKey) => list.reduce((s, p) => s + p[key], 0)

export function delta(current: number, previous: number) {
  if (!previous) return 0
  return ((current - previous) / previous) * 100
}
