import { formatNumber } from '@/lib/format'
import type { UsagePoint } from '@/types'
import { Card } from '@/components/ui'
import { AreaChart } from './AreaChart'
import { sum, type SeriesKey } from './analyticsData'

export const seriesMeta: Record<SeriesKey, { label: string; unit: string; color: string }> = {
  agentConversations: { label: 'Agent conversations', unit: 'conversations', color: '#8f7cff' },
  liveMinutes: { label: 'Live AI minutes', unit: 'min', color: '#5b8dff' },
  videos: { label: 'Videos generated', unit: 'videos', color: '#3ed598' },
}
const order: SeriesKey[] = ['agentConversations', 'liveMinutes', 'videos']

/**
 * Usage over time as small multiples — each measure has its own scale, so
 * they sit side by side rather than sharing (and distorting) one axis.
 */
export function UsageOverTime({ data, periodLabel, granularity }: { data: UsagePoint[]; periodLabel: string; granularity: string }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-semibold">Usage over time</h2>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            {periodLabel} · per {granularity}. Hover or focus a chart to inspect.
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fg-muted" aria-label="Legend">
          {order.map((k) => (
            <li key={k} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: seriesMeta[k].color }} />
              {seriesMeta[k].label}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-6">
        {order.map((k) => {
          const m = seriesMeta[k]
          return (
            <figure key={k} className="min-w-0">
              <figcaption className="mb-3 flex items-baseline justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-[13px] font-medium text-fg-muted">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: m.color }} />
                  {m.label}
                </span>
                <span className="tabular text-[15px] font-semibold text-fg">{formatNumber(sum(data, k))}</span>
              </figcaption>
              <AreaChart data={data.map((p) => ({ label: p.label, value: p[k] }))} color={m.color} label={`${m.label} per ${granularity}, ${periodLabel.toLowerCase()}`} unit={m.unit} variant={k === 'videos' && granularity === 'day' ? 'bars' : 'area'} />
            </figure>
          )
        })}
      </div>
      <div className="sr-only">
      <table>
        <caption>Usage per {granularity}, {periodLabel.toLowerCase()}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {order.map((k) => (
              <th key={k} scope="col">
                {seriesMeta[k].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((p, i) => (
            <tr key={p.label + i}>
              <th scope="row">{p.label}</th>
              {order.map((k) => (
                <td key={k}>{p[k]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </Card>
  )
}
