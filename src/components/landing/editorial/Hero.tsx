import { Play } from 'lucide-react'
import { STEPS } from './content'
import { ButtonLink } from './primitives'
import { AvatarStage } from './AvatarStage'
import { Tilt3D } from './Tilt3D'

export function Hero({ onWatchDemo }: { onWatchDemo: () => void }) {
  return (
    <section aria-labelledby="hero-title" className="relative">
      <div className="l-wrap">
        {/* Masthead row */}
        <div className="flex items-center justify-between gap-6 border-b border-line py-4 text-fg-subtle">
          <span className="l-label">Rooman Agent · by Rooman Technologies</span>
          <span className="l-label hidden sm:inline">Avatar · Agent · Live</span>
        </div>

        <div className="grid grid-cols-4 gap-x-4 pt-10 sm:grid-cols-6 sm:gap-x-6 lg:grid-cols-12 lg:gap-x-8 lg:pt-20">
          {/* Headline */}
          <div className="col-span-4 sm:col-span-6 lg:col-span-7 lg:pb-20">
            <h1 id="hero-title" className="l-display l-flip">
              <span className="l-flip-line">Your face.</span>
              <span className="l-flip-line">Your voice.</span>
              <span className="l-flip-line">Your <span className="l-grad-text">agent.</span></span>
            </h1>

            <p className="l-lede mt-10 animate-fade-up lg:mt-14" style={{ animationDelay: '80ms' }}>
              Upload a short video of yourself and get an AI avatar. Describe the agent you need, out loud. Then let it
              hold live conversations — with your face and your voice.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5 animate-fade-up" style={{ animationDelay: '160ms' }}>
              <ButtonLink to="/signup">Create your avatar</ButtonLink>
              <button type="button" onClick={onWatchDemo} className="group inline-flex items-center gap-3 text-[15px] font-medium">
                <span className="flex size-9 items-center justify-center border border-fg transition-colors duration-300 group-hover:bg-fg group-hover:text-canvas">
                  <Play className="size-3.5 fill-current" strokeWidth={0} aria-hidden />
                </span>
                <span className="l-link">Watch the demo</span>
              </button>
            </div>
          </div>

          {/* The real product output — bleeds to the right edge on desktop */}
          <Tilt3D max={8} className="relative col-span-4 mt-14 sm:col-span-6 lg:col-span-5 lg:-mr-12 lg:mt-0">
            <AvatarStage frameClassName="aspect-[4/5] rounded-[28px] shadow-[0_0_100px_-10px_rgba(139,92,246,0.6)] lg:aspect-auto lg:h-[620px]" className="lg:pr-12" />
            <div className="pointer-events-none absolute top-6 hidden max-w-[15rem] rounded-[16px] border border-[var(--l-rule-strong)] bg-[var(--l-card)] backdrop-blur-xl py-4 pl-5 pr-6 text-[var(--l-ink)] shadow-[0_24px_50px_-18px_rgba(20,26,44,0.9)] [transform:translateZ(70px)] lg:-left-16 lg:block">
              <p className="l-label text-[var(--l-ink)]">Not a recording</p>
              <p className="mt-2 font-display text-[21px] leading-[1.15] tracking-[-0.01em]">
                Generated from a script, in a face that stays the same.
              </p>
            </div>
          </Tilt3D>
        </div>
      </div>

      {/* How it works — three steps */}
      <div className="l-wrap mt-20 lg:mt-12">
        <ol className="grid border-t border-fg sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.id} className={`border-b border-line sm:border-b-0 ${i > 0 ? 'sm:border-l sm:pl-6' : ''} ${i < 2 ? 'sm:pr-6' : ''}`}>
              <a href={`#${s.id}`} className="group flex items-baseline gap-5 py-6 sm:block sm:py-8">
                <span className="l-label text-fg-subtle">{String(i + 1).padStart(2, '0')}</span>
                <span className="sm:mt-6 sm:block">
                  <span className="block font-display text-[24px] leading-tight tracking-[-0.015em] sm:text-[28px]">
                    <span className="l-link">{s.title}</span>
                  </span>
                  <span className="mt-1.5 block text-[15px] text-fg-muted">{s.body}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
