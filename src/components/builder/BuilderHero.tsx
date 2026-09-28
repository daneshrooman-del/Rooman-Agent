import { useRef, useState } from 'react'
import { Briefcase, Headphones, Sparkles, TrendingUp } from 'lucide-react'
import type { Avatar } from '@/types'
import { AvatarChip } from '@/components/avatar/AvatarPreview'
import { Composer } from './Composer'
import { EXAMPLE_PROMPTS } from './templates'

const ICONS = [Briefcase, TrendingUp, Headphones]

export function BuilderHero({ onSend, avatar }: { onSend: (text: string) => void; avatar: Avatar | undefined }) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  return (
    <section className="relative isolate flex min-h-[calc(100dvh-13rem)] flex-col items-center justify-center py-6 text-center lg:min-h-[calc(100dvh-10rem)]">
      {/* ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[8%] -z-10 mx-auto h-[420px] max-w-[760px] animate-breathe rounded-full bg-[radial-gradient(closest-side,rgb(143_124_255/0.16),transparent)] blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20 grid-lines opacity-40 [mask-image:radial-gradient(60%_50%_at_50%_40%,black,transparent)]" />

      <div className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-line bg-white/[0.03] py-1 pl-1 pr-3 text-[12px] text-fg-muted">
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-accent/12 px-2 font-medium text-[#c6bcff]">
          <Sparkles className="size-3" aria-hidden />
          AI Builder
        </span>
        {avatar ? (
          <span className="inline-flex items-center gap-1.5">
            <AvatarChip avatar={avatar} size={16} />
            Powered by {avatar.name}
          </span>
        ) : (
          'Orchestration layer'
        )}
      </div>

      <h1
        className="mt-6 max-w-[14ch] animate-fade-up text-[40px] font-semibold leading-[1.02] tracking-[-0.035em] sm:max-w-none sm:text-[56px]"
        style={{ animationDelay: '60ms' }}
      >
        What should your <span className="text-gradient">AI agent</span> do?
      </h1>
      <p className="mt-4 max-w-md animate-fade-up text-[15px] text-fg-muted sm:text-[16px]" style={{ animationDelay: '120ms' }}>
        Describe the job. Your AI Builder will turn it into a deployable agent.
      </p>

      <div className="mt-9 w-full max-w-[760px] animate-fade-up text-left" style={{ animationDelay: '180ms' }}>
        <Composer
          ref={ref}
          size="hero"
          value={value}
          onChange={setValue}
          onSend={() => onSend(value)}
          placeholder="e.g. An agent that answers calls from HR teams and helps place candidates…"
          footer={
            <span className="hidden sm:inline">
              <kbd className="font-sans text-fg-muted">Enter</kbd> to send · <kbd className="font-sans text-fg-muted">Shift + Enter</kbd> for a new line
            </span>
          }
        />
      </div>

      <div className="mt-6 w-full max-w-[760px] animate-fade-up" style={{ animationDelay: '240ms' }}>
        <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-fg-subtle">Start from an example</p>
        <ul className="grid gap-2.5 text-left sm:grid-cols-3">
          {EXAMPLE_PROMPTS.map((p, i) => {
            const Icon = ICONS[i]
            return (
              <li key={p.label}>
                <button
                  type="button"
                  onClick={() => {
                    setValue(p.text)
                    requestAnimationFrame(() => ref.current?.focus())
                  }}
                  className="group flex h-full w-full flex-col gap-2 rounded-card border border-line bg-white/[0.02] p-4 text-left transition-all duration-300 ease-out-soft hover:-translate-y-0.5 hover:border-line-strong hover:bg-white/[0.04]"
                >
                  <span className="inline-flex items-center gap-2 text-[13px] font-medium text-fg">
                    <Icon className="size-4 text-accent" aria-hidden />
                    {p.label}
                  </span>
                  <span className="line-clamp-2 text-[13px] leading-snug text-fg-muted">{p.text}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
