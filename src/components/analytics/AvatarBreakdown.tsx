import { Link } from 'react-router-dom'
import { formatNumber } from '@/lib/format'
import type { Avatar } from '@/types'
import { Card, StatusIndicator } from '@/components/ui'
import { AvatarChip } from '@/components/avatar/AvatarPreview'

const rows: { key: keyof Avatar['usage']; label: string }[] = [
  { key: 'videos', label: 'Videos' },
  { key: 'liveSessions', label: 'Live sessions' },
  { key: 'agents', label: 'Agents' },
]

/** Per-avatar usage: the same identity powering videos, live sessions and agents. */
export function AvatarBreakdown({ avatars }: { avatars: Avatar[] }) {
  const max = Object.fromEntries(rows.map((r) => [r.key, Math.max(1, ...avatars.map((a) => a.usage[r.key]))])) as Record<keyof Avatar['usage'], number>
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-6">
        <h2 className="text-[17px] font-semibold">One avatar, many experiences</h2>
        <p className="mt-0.5 text-[13px] text-fg-muted">Where each identity shows up across your workspace · all time</p>
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {avatars.map((a) => {
          const total = a.usage.videos + a.usage.liveSessions + a.usage.agents
          return (
            <li key={a.id} className="rounded-[14px] border border-line bg-white/[0.02] p-4">
              <div className="flex items-center gap-3">
                <AvatarChip avatar={a} size={36} />
                <div className="min-w-0 flex-1">
                  <Link to={`/avatars/${a.id}`} className="block truncate text-[14px] font-medium hover:underline">
                    {a.name}
                  </Link>
                  <p className="truncate text-[12px] text-fg-subtle">{a.kind}</p>
                </div>
                {a.status !== 'ready' && <StatusIndicator status={a.status} />}
              </div>
              {total === 0 ? (
                <p className="mt-4 text-[13px] text-fg-subtle">{a.status === 'training' ? 'Available once training completes.' : 'Not used yet.'}</p>
              ) : (
                <dl className="mt-4 flex flex-col gap-3">
                  {rows.map((r) => (
                    <div key={r.key}>
                      <div className="flex items-center justify-between text-[12px]">
                        <dt className="text-fg-muted">{r.label}</dt>
                        <dd className="tabular font-medium text-fg">{formatNumber(a.usage[r.key])}</dd>
                      </div>
                      <div aria-hidden className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${(a.usage[r.key] / max[r.key]) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
