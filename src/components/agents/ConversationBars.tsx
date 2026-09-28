import { useEffect, useRef, useState } from 'react'
import { formatNumber } from '@/lib/format'

export interface DayPoint {
  date: Date
  value: number
}

/** Lightweight single-series bar chart with per-bar hover/focus tooltip and a screen-reader table. */
export function ConversationBars({ points, label }: { points: DayPoint[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<HTMLElement>(null)
  const [width, setWidth] = useState(700)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const W = width
  const H = width < 500 ? 190 : 220
  const pad = { t: 12, r: 8, b: 26, l: 34 }
  const max = Math.max(4, ...points.map((p) => p.value))
  const nice = Math.ceil(max / 4 / 5) * 5 * 4 || 4
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const slot = iw / points.length
  const bw = Math.max(6, Math.min(28, slot - 8))
  const y = (v: number) => pad.t + ih - (v / nice) * ih
  const fmtDay = (d: Date) => d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  const active = hover !== null ? points[hover] : null

  return (
    <figure ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="agentbars" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8f7cff" />
            <stop offset="1" stopColor="#5b8dff" stopOpacity="0.75" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const v = Math.round(nice * f)
          return (
            <g key={f}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="rgb(255 255 255 / 0.06)" strokeDasharray={f === 0 ? undefined : '2 4'} />
              <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#74748a" className="tabular">
                {v}
              </text>
            </g>
          )
        })}
        {points.map((p, i) => {
          const x = pad.l + i * slot + (slot - bw) / 2
          const h = Math.max(2, pad.t + ih - y(p.value))
          const top = pad.t + ih - h
          const r = Math.min(4, bw / 2, h)
          const dim = hover !== null && hover !== i
          return (
            <g key={i}>
              <path
                d={`M${x},${pad.t + ih} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${pad.t + ih} Z`}
                fill="url(#agentbars)"
                opacity={dim ? 0.35 : 1}
                style={{ transition: 'opacity 200ms' }}
              />
              {((i % (W < 500 ? 3 : 2) === 0 && i < points.length - 2) || i === points.length - 1) && (
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#74748a">
                  {i === points.length - 1 ? 'Today' : p.date.getDate()}
                </text>
              )}
              <rect
                x={pad.l + i * slot}
                y={pad.t}
                width={slot}
                height={ih}
                fill="transparent"
                tabIndex={0}
                aria-label={`${fmtDay(p.date)}: ${p.value} conversations`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                style={{ outline: 'none' }}
              />
            </g>
          )
        })}
      </svg>
      {active && hover !== null && (
        <div
          className="glass-strong pointer-events-none absolute top-0 -translate-x-1/2 rounded-[10px] px-3 py-2 text-[12px] shadow-soft"
          style={{ left: `${((pad.l + hover * slot + slot / 2) / W) * 100}%` }}
          role="status"
        >
          <p className="text-fg-subtle">{fmtDay(active.date)}</p>
          <p className="tabular font-semibold text-fg">{formatNumber(active.value)} conversations</p>
        </div>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.date.toISOString()}>
              <th scope="row">{fmtDay(p.date)}</th>
              <td>{p.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
