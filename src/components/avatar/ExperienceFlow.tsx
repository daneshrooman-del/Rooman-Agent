import { Link } from 'react-router-dom'
import { ArrowUpRight, Bot, Clapperboard, Radio } from 'lucide-react'
import type { Avatar } from '@/types'
import { cn } from '@/lib/cn'
import { AvatarChip } from './AvatarPreview'

const destinations = [
  { key: 'video', icon: Clapperboard, layer: 'Content', title: 'Generate videos', text: 'Turn a script into a presenter-led video in minutes.', href: (id: string) => `/create?avatar=${id}` },
  { key: 'live', icon: Radio, layer: 'Interaction', title: 'Go live', text: 'Hold real-time conversations with your own face and voice.', href: (id: string) => `/live?avatar=${id}` },
  { key: 'agent', icon: Bot, layer: 'Orchestration', title: 'Power an agent', text: 'Give an AI agent a trusted identity for calls, web and API.', href: (id: string) => `/agents/new?avatar=${id}` },
]

/** "One identity → many experiences": the avatar node fanning out to the three product layers. */
export function ExperienceFlow({ avatar, className, disabled }: { avatar: Pick<Avatar, 'id' | 'name' | 'hue'>; className?: string; disabled?: boolean }) {
  return (
    <div className={cn('relative', className)}>
      {/* identity node */}
      <div className="flex justify-center">
        <div className="glass relative z-10 inline-flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4">
          <AvatarChip avatar={avatar} size={34} />
          <div className="text-left leading-tight">
            <p className="text-[13px] font-semibold">{avatar.name}</p>
            <p className="text-[11px] text-fg-subtle">One identity</p>
          </div>
        </div>
      </div>

      {/* connectors (tablet+) */}
      <div aria-hidden className="relative hidden h-10 sm:block">
        <span className="absolute left-1/2 top-0 h-5 w-px bg-gradient-to-b from-white/25 to-white/15" />
        <span className="absolute left-[16.66%] right-[16.66%] top-5 h-px bg-white/15" />
        {[16.66, 50, 83.33].map((l) => (
          <span key={l} className="absolute top-5 h-5 w-px bg-gradient-to-b from-white/15 to-accent/50" style={{ left: `${l}%` }} />
        ))}
      </div>
      {/* connector (mobile) */}
      <div aria-hidden className="mx-auto h-6 w-px bg-white/15 sm:hidden" />

      <ul className="relative grid gap-3 sm:grid-cols-3 sm:gap-4">
        {destinations.map(({ key, icon: Icon, layer, title, text, href }, i) => (
          <li key={key} className="animate-fade-up" style={{ animationDelay: `${150 + i * 90}ms` }}>
            <Link
              to={href(avatar.id)}
              aria-disabled={disabled || undefined}
              tabIndex={disabled ? -1 : undefined}
              className={cn(
                'group flex h-full flex-col rounded-card border border-line bg-surface p-5 transition-[border-color,transform,background-color] duration-300 ease-out-soft',
                'hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-2',
                disabled && 'pointer-events-none opacity-45',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-[12px] border border-line-strong bg-white/[0.04]">
                  <Icon className="size-[18px] text-fg" aria-hidden />
                </span>
                <ArrowUpRight className="size-4 text-fg-subtle transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden />
              </div>
              <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">{layer} layer</p>
              <p className="mt-1 text-[15px] font-semibold">{title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{text}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
