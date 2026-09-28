import { BadgeCheck, CalendarDays, Hourglass, Languages, Mic } from 'lucide-react'
import type { Avatar } from '@/types'
import { formatDate } from '@/lib/format'
import { useWorkspace } from '@/state/workspace'

/** Compact definition list of the avatar's identity attributes. */
export function IdentityPanel({ avatar }: { avatar: Avatar }) {
  const { voiceName, data } = useWorkspace()
  const voice = data?.voices.find((v) => v.id === avatar.voiceId)
  const ready = avatar.status === 'ready'
  const rows = [
    { icon: Mic, label: 'Voice', value: voiceName(avatar.voiceId), meta: voice ? `${voice.kind === 'cloned' ? 'Cloned' : 'Stock'} · ${voice.tone}` : undefined },
    { icon: Languages, label: 'Languages', value: avatar.languages.join(', ') },
    { icon: CalendarDays, label: 'Trained', value: ready ? formatDate(avatar.createdAt) : 'In progress', meta: ready ? undefined : `Started ${formatDate(avatar.createdAt)}` },
    {
      icon: ready ? BadgeCheck : Hourglass,
      label: 'Identity consistency',
      value: ready ? 'Verified' : avatar.status === 'failed' ? 'Not verified' : 'Pending',
      tone: ready ? 'text-success' : 'text-fg-muted',
    },
  ]
  return (
    <section aria-labelledby="identity-details" className="rounded-panel border border-line bg-white/[0.02] p-5">
      <h2 id="identity-details" className="text-[13px] font-medium uppercase tracking-[0.12em] text-fg-subtle">
        Identity details
      </h2>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {rows.map(({ icon: Icon, label, value, meta, tone }) => (
          <div key={label} className="flex min-w-0 gap-3">
            <Icon className={`mt-0.5 size-4 shrink-0 ${tone ?? 'text-fg-subtle'}`} aria-hidden />
            <div className="min-w-0">
              <dt className="text-[12px] text-fg-subtle">{label}</dt>
              <dd className={`mt-0.5 truncate text-[14px] font-medium ${tone ?? ''}`}>{value}</dd>
              {meta && <dd className="truncate text-[12px] text-fg-subtle">{meta}</dd>}
            </div>
          </div>
        ))}
      </dl>
    </section>
  )
}
