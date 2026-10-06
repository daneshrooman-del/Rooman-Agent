import { Link } from 'react-router-dom'
import { ArrowRight, Bot, Clapperboard, Radio, UserRoundPlus, type LucideIcon } from 'lucide-react'
import type { Avatar } from '@/types'

interface CardDef {
  step: string
  layer: string
  title: string
  description: string
  to: string
  icon: LucideIcon
  hue: number
  visual: 'identity' | 'frames' | 'wave' | 'nodes'
}

function Visual({ kind, hue }: { kind: CardDef['visual']; hue: number }) {
  const c = `hsl(${hue} 80% 64%)`
  if (kind === 'identity')
    return (
      <svg viewBox="0 0 200 120" className="size-full" aria-hidden>
        {[46, 34, 22].map((r, i) => (
          <circle key={r} cx="150" cy="60" r={r} fill="none" stroke={c} strokeOpacity={0.12 + i * 0.12} />
        ))}
        <circle cx="150" cy="52" r="9" fill={c} fillOpacity="0.6" />
        <path d="M134 78c3-9 9-13 16-13s13 4 16 13" fill="none" stroke={c} strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  if (kind === 'frames')
    return (
      <svg viewBox="0 0 200 120" className="size-full" aria-hidden>
        {[0, 1, 2].map((i) => (
          <rect key={i} x={104 + i * 16} y={26 + i * 10} width="64" height="40" rx="6" className="fill-surface" stroke={c} strokeOpacity={0.2 + i * 0.2} />
        ))}
        <path d="M150 58l10 6-10 6z" fill={c} fillOpacity="0.8" />
      </svg>
    )
  if (kind === 'wave')
    return (
      <svg viewBox="0 0 200 120" className="size-full" aria-hidden>
        {Array.from({ length: 13 }).map((_, i) => {
          const h = [10, 18, 30, 22, 40, 52, 36, 48, 28, 20, 32, 14, 8][i]
          return <rect key={i} x={104 + i * 7} y={60 - h / 2} width="3" height={h} rx="1.5" fill={c} fillOpacity={0.25 + (h / 52) * 0.6} />
        })}
      </svg>
    )
  return (
    <svg viewBox="0 0 200 120" className="size-full" aria-hidden>
      <path d="M120 34v26h48v26M120 60h-4" fill="none" stroke={c} strokeOpacity="0.35" strokeDasharray="3 4" />
      {[
        [120, 34],
        [168, 60],
        [120, 60],
        [168, 86],
      ].map(([x, y], i) => (
        <rect key={i} x={x - 9} y={y - 9} width="18" height="18" rx="5" className="fill-surface" stroke={c} strokeOpacity={0.3 + i * 0.15} />
      ))}
    </svg>
  )
}

export function CreateCards({ avatar }: { avatar: Avatar | undefined }) {
  const q = avatar ? `?avatar=${avatar.id}` : ''
  const cards: CardDef[] = [
    { step: '01', layer: 'Identity', title: 'Create Avatar', description: 'Turn a short video of yourself into a reusable digital twin.', to: '/avatars/new', icon: UserRoundPlus, hue: 212, visual: 'identity' },
    { step: '02', layer: 'Content', title: 'Create Video', description: `Direct ${avatar?.name ?? 'your avatar'} to present, greet or demonstrate — in any language.`, to: `/create${q}`, icon: Clapperboard, hue: 226, visual: 'frames' },
    { step: '03', layer: 'Interaction', title: 'Go Live', description: 'Hold a real-time conversation with the same avatar, face to face.', to: `/live${q}`, icon: Radio, hue: 199, visual: 'wave' },
    { step: '04', layer: 'Workforce', title: 'Build Agent', description: 'Describe a job and deploy an agent that works through voice, video and API.', to: `/agents/new${q}`, icon: Bot, hue: 205, visual: 'nodes' },
  ]
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c, i) => (
        <li key={c.title} className="animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
          <Link
            to={c.to}
            className="group relative flex h-full min-h-[228px] flex-col overflow-hidden rounded-panel border border-line bg-surface p-6 shadow-soft transition-[transform,border-color,box-shadow] duration-300 ease-out-soft hover:-translate-y-1 hover:border-line-strong hover:shadow-[0_30px_70px_-30px_rgb(var(--rgb-shadow)/0.5),0_0_0_1px_rgb(var(--rgb-accent)/0.16)]"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 size-56 rounded-full opacity-50 blur-3xl transition-opacity duration-500 group-hover:opacity-90"
              style={{ background: `radial-gradient(closest-side, hsl(${c.hue} 80% 55% / 0.35), transparent)` }}
            />
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-3/5 opacity-70 transition-transform duration-500 ease-out-soft group-hover:-translate-x-1">
              <Visual kind={c.visual} hue={c.hue} />
            </div>
            <div className="relative flex items-center justify-between">
              <span className="flex size-11 items-center justify-center rounded-[14px] border border-line-strong bg-fg/[0.05] text-fg">
                <c.icon className="size-5" aria-hidden />
              </span>
            </div>
            <div className="relative mt-auto pt-10">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
                {c.step} · {c.layer}
              </p>
              <h3 className="mt-2 flex items-center gap-2 text-[19px] font-semibold">
                {c.title}
                <ArrowRight className="size-4 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{c.description}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
