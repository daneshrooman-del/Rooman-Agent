import { useId, useState, type KeyboardEvent } from 'react'
import { formatNumber } from '@/lib/format'
import { useElementWidth } from './useElementWidth'

export interface ChartPoint {
  label: string
  value: number
}

function niceMax(v: number) {
  if (v <= 0) return 1
  const mag = 10 ** Math.floor(Math.log10(v))
  const n = v / mag
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * mag
}

/**
 * Single-series area chart with a crosshair tooltip. Hover or focus the plot
 * and use ← → to step through points. One series per chart (no dual axes) —
 * compose several as small multiples.
 */
export function AreaChart({
  data,
  color,
  label,
  unit = '',
  height = 168,
  format = formatNumber,
  variant = 'area',
}: {
  data: ChartPoint[]
  color: string
  /** accessible name, e.g. "Agent conversations per day" */
  label: string
  unit?: string
  height?: number
  format?: (v: number) => string
  /** columns suit small whole-number counts per day */
  variant?: 'area' | 'bars'
}) {
  const { ref, width } = useElementWidth<HTMLDivElement>()
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [active, setActive] = useState<number | null>(null)

  const padL = 34
  const padR = 8
  const padT = 10
  const padB = 24
  const w = Math.max(width, 120)
  const innerW = w - padL - padR
  const innerH = height - padT - padB
  const max = niceMax(Math.max(...data.map((d) => d.value), 0))
  const bars = variant === 'bars'
  const slot = innerW / Math.max(1, data.length)
  const x = (i: number) => (bars ? padL + slot * (i + 0.5) : padL + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW))
  const y = (v: number) => padT + innerH - (v / max) * innerH

  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const area = data.length ? `${line} L${x(data.length - 1).toFixed(1)},${padT + innerH} L${x(0).toFixed(1)},${padT + innerH} Z` : ''
  const ticks = [0, max / 2, max]
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 64))))

  const onMove = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left
    const i = bars ? Math.floor((px - padL) / slot) : Math.round(((px - padL) / innerW) * (data.length - 1))
    setActive(Math.max(0, Math.min(data.length - 1, i)))
  }
  const onKey = (e: KeyboardEvent) => {
    if (!data.length) return
    const cur = active ?? data.length - 1
    let next = cur
    if (e.key === 'ArrowRight') next = Math.min(data.length - 1, cur + 1)
    else if (e.key === 'ArrowLeft') next = Math.max(0, cur - 1)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = data.length - 1
    else return
    e.preventDefault()
    setActive(next)
  }

  const a = active !== null ? data[active] : null
  const tipLeft = active !== null ? Math.min(Math.max(x(active), padL + 50), w - 60) : 0

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={w}
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        role="img"
        aria-label={`${label}. Use arrow keys to inspect values.`}
        tabIndex={0}
        className="block overflow-visible rounded-[8px] focus-visible:outline-offset-4"
        onMouseMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
        onMouseLeave={() => setActive(null)}
        onTouchStart={(e) => onMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
        onTouchMove={(e) => onMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
        onFocus={() => setActive(data.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
      >
        <defs>
          <linearGradient id={`fill-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="rgb(255 255 255 / 0.06)" strokeDasharray={t === 0 ? undefined : '2 4'} />
            <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-fg-subtle text-[10px] tabular">
              {formatNumber(Math.round(t))}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const last = i === data.length - 1
          const show = last || (i % labelEvery === 0 && data.length - 1 - i >= labelEvery)
          return show ? (
            <text key={d.label + i} x={x(i)} y={height - 6} textAnchor={bars ? 'middle' : i === 0 ? 'start' : last ? 'end' : 'middle'} className="fill-fg-subtle text-[10px]">
              {d.label}
            </text>
          ) : null
        })}
        {bars ? (
          data.map((d, i) => {
            const bw = Math.max(2, Math.min(8, slot * 0.5))
            const top = y(d.value)
            const hgt = padT + innerH - top
            return hgt > 0 ? (
              <rect key={i} x={x(i) - bw / 2} y={top} width={bw} height={hgt} rx={Math.min(3, bw / 2)} fill={color} opacity={active === null || active === i ? 0.85 : 0.35} />
            ) : null
          })
        ) : (
          <>
            <path d={area} fill={`url(#fill-${uid})`} />
            <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </>
        )}
        {a && active !== null && (
          <g>
            <line x1={x(active)} x2={x(active)} y1={padT} y2={padT + innerH} stroke="rgb(255 255 255 / 0.18)" />
            {!bars && <circle cx={x(active)} cy={y(a.value)} r="5" fill={color} stroke="#0e0e13" strokeWidth="2" />}
          </g>
        )}
      </svg>
      {a && (
        <div
          className="glass-strong pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-1/4 whitespace-nowrap rounded-[10px] px-2.5 py-1.5 text-[12px] shadow-[0_12px_30px_-10px_rgb(0_0_0/0.8)]"
          style={{ left: tipLeft }}
          aria-live="polite"
        >
          <span className="text-fg-subtle">{a.label}</span>{' '}
          <span className="tabular font-medium text-fg">
            {format(a.value)}
            {unit && ` ${unit}`}
          </span>
        </div>
      )}
    </div>
  )
}
