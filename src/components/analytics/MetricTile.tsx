import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Sparkline } from './Sparkline'

export function Delta({ value, suffix }: { value: number; suffix?: string }) {
  const up = value >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex items-center gap-1 text-[12px]">
      <span className={cn('tabular inline-flex items-center gap-0.5 font-medium', up ? 'text-success' : 'text-[#ff8a95]')}>
        <Icon className="size-3.5" aria-hidden />
        <span className="sr-only">{up ? 'Up' : 'Down'}</span>
        {Math.abs(value).toFixed(value !== 0 && Math.abs(value) < 10 ? 1 : 0)}%
      </span>
      {suffix && (
        <span className="text-fg-subtle">
          <span className="sm:hidden">vs prior</span>
          <span className="hidden sm:inline">{suffix}</span>
        </span>
      )}
    </span>
  )
}

/** Primary KPI tile: label, headline value, delta vs previous period and a tiny trend. */
export function MetricTile({
  label,
  value,
  unit,
  delta,
  deltaSuffix,
  trend,
  color,
  icon,
  index = 0,
}: {
  label: string
  value: string
  unit?: string
  delta: number
  deltaSuffix: string
  trend: number[]
  color: string
  icon: ReactNode
  index?: number
}) {
  return (
    <div className="surface relative flex animate-fade-up flex-col overflow-hidden rounded-card p-4 shadow-soft sm:p-5" style={{ animationDelay: `${index * 50}ms` }}>
      <div className="flex items-center gap-2 text-[13px] text-fg-muted [&_svg]:hidden [&_svg]:size-4 [&_svg]:text-fg-subtle sm:[&_svg]:block">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-3 text-[26px] font-semibold leading-none tracking-[-0.02em] sm:text-[30px]">
        <span className="tabular">{value}</span>
        {unit && <span className="ml-1 text-[14px] font-normal text-fg-subtle">{unit}</span>}
      </p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <Delta value={delta} suffix={deltaSuffix} />
      </div>
      <Sparkline values={trend} color={color} className="mt-3 h-8 w-full" />
    </div>
  )
}
