import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, Play, Volume2, VolumeX, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { AvatarVideo } from '../AvatarVideo'
import { AVATAR_OPTIONS } from '../HeroShowcase'
import { useInView } from '../hooks'
import { Button } from './ui'

/* Avatars shown on the landing page (Dev is left out). */
const AVATARS = AVATAR_OPTIONS.filter((a) => a.id !== 'dev')

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#use-cases', label: 'Use cases' },
  { href: '#faq', label: 'FAQ' },
]

export function Logo() {
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="font-display text-[20px] font-bold tracking-[-0.02em] text-fg">Rooman</span>
      <span className="text-[15px] font-medium text-accent">Agent</span>
    </span>
  )
}

export function ModernNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-[#FAF8F4]">
      <div className="m-wrap flex h-16 items-center justify-between gap-4">
        <Link to="/" aria-label="Rooman Agent home">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-8">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="text-[15px] font-medium text-fg-muted transition-colors hover:text-fg">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/signin" className="hidden text-[15px] font-medium text-fg hover:text-accent sm:inline">
            Sign in
          </Link>
          <Button to="/signup" size="sm" arrow={false}>
            Get started
          </Button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="m-mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="grid size-10 place-items-center rounded-lg text-fg hover:bg-black/[0.05] md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      <div id="m-mobile-nav" hidden={!open} className="border-t border-line bg-[#FAF8F4] md:hidden">
        <ul className="m-wrap py-2">
          {[...LINKS, { href: '/signin', label: 'Sign in' }].map((l) => (
            <li key={l.href} className="border-b border-line last:border-0">
              {l.href.startsWith('/') ? (
                <Link to={l.href} onClick={() => setOpen(false)} className="block py-3.5 text-[16px] font-medium text-fg">
                  {l.label}
                </Link>
              ) : (
                <a href={l.href} onClick={() => setOpen(false)} className="block py-3.5 text-[16px] font-medium text-fg">
                  {l.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </header>
  )
}

/** The real product output: a lip-synced avatar clip, with an avatar switcher and sound toggle. */
function AvatarPlayer() {
  const [index, setIndex] = useState(0)
  const [muted, setMuted] = useState(true)
  const [ref, inView] = useInView<HTMLDivElement>(0.3)
  const avatar = AVATARS[index]

  return (
    <figure>
      <div ref={ref} className="relative aspect-[4/5] overflow-hidden rounded-[20px] border border-line bg-[#E9E4DA]">
        <AvatarVideo
          avatar={avatar}
          src={avatar.video}
          playing={inView}
          muted={muted}
          onAutoplayBlocked={() => setMuted(true)}
          className="absolute inset-0 [&_img]:object-cover [&_video]:object-cover"
        />
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
          className="absolute bottom-4 right-4 grid size-10 place-items-center rounded-full bg-white text-fg shadow-sm transition hover:bg-[#F1ECE3]"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>
      <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[14px] text-fg-muted">Real output: an AI avatar lip-synced to a new script.</span>
        <span role="group" aria-label="Choose an avatar" className="flex gap-1 rounded-lg border border-line bg-white p-1">
          {AVATARS.map((a, i) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                'rounded-md px-3 py-1 text-[13px] font-semibold transition-colors',
                i === index ? 'bg-accent text-white' : 'text-fg-muted hover:text-fg',
              )}
            >
              {a.name}
            </button>
          ))}
        </span>
      </figcaption>
    </figure>
  )
}

export function ModernHero({ onWatchDemo }: { onWatchDemo: () => void }) {
  return (
    <section aria-labelledby="hero-title" className="pt-12 pb-4 sm:pt-20">
      <div className="m-wrap grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="m-rise">
          <p className="text-[14px] font-semibold text-accent">Rooman Agent, by Rooman Technologies</p>
          <h1 id="hero-title" className="mt-5 font-display text-[44px] font-bold leading-[1.04] tracking-[-0.035em] text-fg sm:text-[60px] lg:text-[68px]">
            Your face.<br />Your voice.<br /><span className="m-grad-text">Your agent.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-fg-muted sm:text-[19px]">
            Upload a short video of yourself and get an AI avatar. Describe the agent you need, out loud. Then let it
            hold live conversations with your face and your voice.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button to="/signup">Create your avatar</Button>
            <button type="button" onClick={onWatchDemo} className="m-btn m-btn-ghost">
              <Play className="size-4 fill-current" aria-hidden /> Watch the demo
            </button>
          </div>
        </div>
        <div className="m-rise mx-auto w-full max-w-[460px] lg:max-w-none" style={{ animationDelay: '120ms' }}>
          <AvatarPlayer />
        </div>
      </div>
    </section>
  )
}
