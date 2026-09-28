import { useMemo, useState, type ReactNode } from 'react'
import { Bot, Clapperboard, Clock, MessagesSquare, Radio } from 'lucide-react'
import { useWorkspace } from '@/state/workspace'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatBytes, formatNumber } from '@/lib/format'
import { DemoNote, PageHeader, SegmentedControl } from '@/components/ui'
import { MetricTile, Delta } from '@/components/analytics/MetricTile'
import { UsageOverTime, seriesMeta } from '@/components/analytics/UsageOverTime'
import { AvatarBreakdown } from '@/components/analytics/AvatarBreakdown'
import { TopAgents } from '@/components/analytics/TopAgents'
import { CreditsMeter } from '@/components/analytics/CreditsMeter'
import { buildPeriod, delta, periodLabel, previousLabel, sum, type Period } from '@/components/analytics/analyticsData'

export default function AnalyticsPage() {
  useDocumentTitle('Analytics')
  const { data, isDemo, avatarById } = useWorkspace()
  const [period, setPeriod] = useState<Period>('30d')
  const series = useMemo(() => buildPeriod(data?.usage ?? [], period), [data?.usage, period])
  if (!data) return null

  const { current, previous } = series
  // Average lengths from the workspace's own content convert counts into minutes.
  const ready = data.videos.filter((v) => v.status === 'ready' && v.durationSec)
  const avgVideoMin = ready.length ? ready.reduce((s, v) => s + v.durationSec, 0) / ready.length / 60 : 1
  const avgLiveMin = data.liveSessions.length ? data.liveSessions.reduce((s, l) => s + l.durationSec, 0) / data.liveSessions.length / 60 : 6
  const deployed = data.agents.filter((a) => a.stats.conversations)
  const avgAgentMin = deployed.length ? deployed.reduce((s, a) => s + a.stats.avgDurationSec, 0) / deployed.length / 60 : 4

  const m = (list: typeof current) => {
    const videos = sum(list, 'videos')
    const live = sum(list, 'liveMinutes')
    const convs = sum(list, 'agentConversations')
    return {
      videos,
      videoMinutes: Math.round(videos * avgVideoMin),
      liveConversations: Math.round(live / avgLiveMin),
      agentConversations: convs,
      conversationMinutes: Math.round(live + convs * avgAgentMin),
    }
  }
  const cur = m(current)
  const prev = m(previous)
  const vs = previousLabel[period]
  const trend = (k: 'videos' | 'liveMinutes' | 'agentConversations') => current.map((p) => p[k])
  const liveAgents = data.agents.filter((a) => a.status === 'live').length
  const { storage, credits } = data.workspace
  const today = new Date()
  const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() + 1

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Analytics"
        description="How your avatars are working — across videos, live conversations and agents."
        actions={
          <SegmentedControl
            label="Time period"
            value={period}
            onChange={setPeriod}
            options={[
              { value: '7d', label: '7 days' },
              { value: '30d', label: '30 days' },
              { value: '6m', label: '6 months' },
            ]}
          />
        }
      />

      <section aria-label={`Key metrics, ${periodLabel[period].toLowerCase()}`} className="mt-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MetricTile index={0} label="Video generations" icon={<Clapperboard />} value={formatNumber(cur.videos)} delta={delta(cur.videos, prev.videos)} deltaSuffix={vs} trend={trend('videos')} color={seriesMeta.videos.color} />
          <MetricTile index={1} label="Generated minutes" icon={<Clock />} value={formatNumber(cur.videoMinutes)} unit="min" delta={delta(cur.videoMinutes, prev.videoMinutes)} deltaSuffix={vs} trend={trend('videos')} color={seriesMeta.videos.color} />
          <MetricTile index={2} label="Live conversations" icon={<Radio />} value={formatNumber(cur.liveConversations)} delta={delta(cur.liveConversations, prev.liveConversations)} deltaSuffix={vs} trend={trend('liveMinutes')} color={seriesMeta.liveMinutes.color} />
          <MetricTile index={3} label="Agent conversations" icon={<MessagesSquare />} value={formatNumber(cur.agentConversations)} delta={delta(cur.agentConversations, prev.agentConversations)} deltaSuffix={vs} trend={trend('agentConversations')} color={seriesMeta.agentConversations.color} />
        </div>

        <dl className="surface mt-3 grid grid-cols-2 overflow-hidden rounded-card shadow-soft sm:mt-4 lg:grid-cols-4">
          <Stat label="Conversation minutes" value={formatNumber(cur.conversationMinutes)} unit="min" extra={<Delta value={delta(cur.conversationMinutes, prev.conversationMinutes)} />} />
          <Stat label="Active agents" value={String(liveAgents)} unit={`of ${data.agents.length}`} extra={<span className="inline-flex items-center gap-1 text-[12px] text-fg-subtle"><Bot className="size-3.5" aria-hidden />live now</span>} />
          <Stat label="Storage" value={formatBytes(storage.usedBytes)} unit={`of ${formatBytes(storage.totalBytes)}`} meter={storage.usedBytes / storage.totalBytes} />
          <Stat label="Credits used" value={formatNumber(credits.used)} unit={`of ${formatNumber(credits.total)}`} meter={credits.used / credits.total} />
        </dl>
      </section>

      <section className="mt-10" aria-label="Usage over time">
        <UsageOverTime data={current} periodLabel={periodLabel[period]} granularity={period === '6m' ? 'month' : 'day'} />
      </section>

      <section className="mt-5" aria-label="Usage by avatar">
        <AvatarBreakdown avatars={data.avatars} />
      </section>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section className="lg:col-span-7" aria-label="Top agents">
          <TopAgents agents={data.agents} avatarById={(id) => avatarById(id)} />
        </section>
        <section className="flex lg:col-span-5 [&>*]:flex-1" aria-label="Credits">
          <CreditsMeter used={credits.used} total={credits.total} plan={data.workspace.plan} daysLeft={daysLeft} />
        </section>
      </div>

      {isDemo && <DemoNote className="mt-10">Sample analytics — daily figures are modelled from monthly demo totals.</DemoNote>}
    </div>
  )
}

function Stat({ label, value, unit, extra, meter }: { label: string; value: string; unit?: string; extra?: ReactNode; meter?: number }) {
  return (
    <div className="flex flex-col gap-1.5 border-line p-4 sm:px-5 [&:nth-child(odd)]:border-r lg:[&:not(:last-child)]:border-r [&:nth-child(-n+2)]:border-b lg:[&:nth-child(-n+2)]:border-b-0">
      <dt className="text-[12px] text-fg-subtle">{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="tabular text-[18px] font-semibold">{value}</span>
        {unit && <span className="text-[12px] text-fg-subtle">{unit}</span>}
      </dd>
      {extra && <dd>{extra}</dd>}
      {meter !== undefined && (
        <dd aria-hidden className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <span className="block h-full rounded-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${Math.round(meter * 100)}%` }} />
        </dd>
      )}
    </div>
  )
}
