import { formatNumber } from '@/lib/format'
import { ButtonLink, Card } from '@/components/ui'

/** Donut meter for plan credits. */
export function RingMeter({ value, total, size = 148, label }: { value: number; total: number; size?: number; label: string }) {
  const pct = total ? Math.min(1, value / total) : 0
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="size-full -rotate-90"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={value}
        aria-valuetext={`${formatNumber(value)} of ${formatNumber(total)} (${Math.round(pct * 100)}%)`}
      >
        <defs>
          <linearGradient id="credits-ring" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#8f7cff" />
            <stop offset="100%" stopColor="#5b8dff" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#credits-ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          className="transition-[stroke-dasharray] duration-700 ease-out-soft"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-[26px] font-semibold leading-none">{Math.round(pct * 100)}%</span>
        <span className="mt-1 text-[11px] text-fg-subtle">used</span>
      </div>
    </div>
  )
}

export function CreditsMeter({ used, total, plan, daysLeft }: { used: number; total: number; plan: string; daysLeft: number }) {
  const remaining = Math.max(0, total - used)
  return (
    <Card className="flex flex-col p-5 sm:p-6">
      <div className="mb-6">
        <h2 className="text-[17px] font-semibold">Credits</h2>
        <p className="mt-0.5 text-[13px] text-fg-muted">
          {plan} plan · resets in {daysLeft} days
        </p>
      </div>
      <div className="flex flex-1 flex-col items-center gap-6 sm:flex-row lg:flex-col xl:flex-row">
        <RingMeter value={used} total={total} label="Credits used this cycle" />
        <dl className="grid w-full grid-cols-2 gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-1">
          <div>
            <dt className="text-[12px] text-fg-subtle">Used this cycle</dt>
            <dd className="tabular mt-0.5 text-[18px] font-semibold">{formatNumber(used)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-fg-subtle">Remaining</dt>
            <dd className="tabular mt-0.5 text-[18px] font-semibold">{formatNumber(remaining)}</dd>
          </div>
          <div className="col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1">
            <dt className="text-[12px] text-fg-subtle">At the current pace</dt>
            <dd className="mt-0.5 text-[13px] text-fg-muted">Enough for about {formatNumber(Math.round(remaining / 48))} more minutes of video</dd>
          </div>
        </dl>
      </div>
      <ButtonLink to="/settings?section=billing" variant="secondary" size="sm" className="mt-6 self-start">
        Manage billing
      </ButtonLink>
    </Card>
  )
}
