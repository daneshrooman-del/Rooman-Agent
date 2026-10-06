import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Menu, Plus, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { BUILDER_EXAMPLE, BUILDER_SLOTS, FAQ, PHOTOS, USE_CASES, type PhotoKey } from '../editorial/content'
import { Tilt3D } from '../editorial/Tilt3D'
import { HeroStage } from './HeroStage'

/* ───────────────────────── shared bits ───────────────────────── */

function useReducedMotion() {
  const [r, setR] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setR(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return r
}

/** Whether the element is currently on screen. */
function useOnScreen<T extends Element>() {
  const ref = useRef<T>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, on] as const
}

function useSeen<T extends Element>(threshold = 0.15) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return setSeen(true)
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setSeen(true)
        io.disconnect()
      }
    }, { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, seen] as const
}

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const [ref, seen] = useSeen<HTMLDivElement>()
  return (
    <div ref={ref} style={delay ? { transitionDelay: `${delay}ms` } : undefined} className={cn('s-reveal', seen && 'is-in', className)}>
      {children}
    </div>
  )
}

function Btn({ to, children, variant = 'primary', size, className, arrow = variant === 'primary' }: {
  to: string
  children: ReactNode
  variant?: 'primary' | 'ghost' | 'ink'
  size?: 'sm'
  className?: string
  arrow?: boolean
}) {
  const cls = cn('s-btn', `s-btn-${variant}`, size === 'sm' && 's-btn-sm', className)
  const inner = (
    <>
      {children}
      {arrow && <ArrowRight className="size-4" aria-hidden />}
    </>
  )
  if (to.startsWith('#') || to.startsWith('mailto:')) return <a href={to} className={cls}>{inner}</a>
  return <Link to={to} className={cls}>{inner}</Link>
}

export function Photo({ name, sizes, className, position }: { name: PhotoKey; sizes: string; className?: string; position?: string }) {
  const m = PHOTOS[name]
  return (
    <img
      src={`/images/landing/${name}-1400.webp`}
      srcSet={[800, 1400, 2200].map((w) => `/images/landing/${name}-${w}.webp ${w}w`).join(', ')}
      sizes={sizes}
      width={m.w}
      height={m.h}
      alt={m.alt}
      loading="lazy"
      decoding="async"
      style={position ? { objectPosition: position } : undefined}
      className={cn('size-full object-cover', className)}
    />
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 whitespace-nowrap', className)}>
      <img src="/images/rooman-logo.png" alt="Rooman" width={307} height={80} className="h-9 w-auto sm:h-10" />
      <span className="rounded-md bg-[var(--ink)] px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider text-[var(--on-ink)]">Agent</span>
    </span>
  )
}

/* ───────────────────────── navigation ───────────────────────── */

const NAV = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/use-cases', label: 'Use cases' },
  { href: '/faq', label: 'FAQ' },
]

export function StudioNav() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const current = NAV.find((l) => pathname.startsWith(l.href))?.href ?? null

  // shadow once scrolled
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const y = window.scrollY
      setScrolled(y > 8)
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
    }
  }, [pathname])

  // sliding highlight: the hovered link, else the current page
  const target = hover ?? current
  useEffect(() => {
    const li = target ? listRef.current?.querySelector<HTMLElement>(`li[data-href="${target}"]`) : null
    setPill(li ? { left: li.offsetLeft, width: li.offsetWidth } : null)
  }, [target])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 h-[72px] w-full border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur-sm transition-shadow duration-300',
        scrolled && 'shadow-[0_14px_34px_-24px_rgba(29,58,154,0.55)]',
      )}
    >
      <div className="flex h-full w-full items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
        <Link to="/" aria-label="Rooman Agent home" className="shrink-0"><Wordmark /></Link>
        <nav aria-label="Primary" className="hidden md:block">
          <ul ref={listRef} onMouseLeave={() => setHover(null)} className="relative flex gap-1">
            {pill && (
              <span
                aria-hidden
                className="absolute inset-y-0 rounded-xl bg-[var(--surface)] ring-1 ring-[var(--border)] transition-all duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
                style={{ left: pill.left, width: pill.width }}
              />
            )}
            {NAV.map((l) => (
              <li key={l.href} data-href={l.href} className="relative">
                <NavLink
                  to={l.href}
                  onMouseEnter={() => setHover(l.href)}
                  onFocus={() => setHover(l.href)}
                  onBlur={() => setHover(null)}
                  className={({ isActive }) =>
                    cn('relative block rounded-xl px-4 py-2 text-[15px] font-medium transition-colors', isActive ? 'text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]')
                  }
                >
                  {({ isActive }) => (
                    <>
                      {l.label}
                      <span aria-hidden className={cn('absolute inset-x-4 -bottom-0.5 h-[2px] origin-left rounded-full bg-[var(--accent)] transition-transform duration-300', isActive ? 'scale-x-100' : 'scale-x-0')} />
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/signin" className="hidden rounded-xl px-3 py-2 text-[15px] font-semibold transition-colors hover:bg-[var(--surface)] sm:inline">Sign in</Link>
          <Btn to="/signup" size="sm" arrow={false}>Get started</Btn>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="s-mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="grid size-10 place-items-center rounded-lg hover:bg-[var(--surface)] md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      <div id="s-mobile-nav" hidden={!open} className="border-b border-[var(--border)] bg-[var(--bg)] md:hidden">
        <ul className="px-5 py-2">
          {NAV.map((l) => (
            <li key={l.href} className="border-b border-[var(--border)]">
              <NavLink to={l.href} onClick={() => setOpen(false)} className={({ isActive }) => cn('block py-4 font-display text-[22px] font-bold [font-stretch:112%]', isActive && 'text-[var(--accent)]')}>{l.label}</NavLink>
            </li>
          ))}
          <li><Link to="/signin" onClick={() => setOpen(false)} className="block py-4 font-display text-[22px] font-bold [font-stretch:112%]">Sign in</Link></li>
        </ul>
      </div>
    </header>
  )
}

/* ───────────────────────── hero ───────────────────────── */

export function StudioHero() {
  return (
    <section aria-labelledby="hero-title" className="pt-6 sm:pt-8">
      <div className="s-wrap grid items-center gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-2">
        <div>
          <h1 id="hero-title" className="s-display whitespace-nowrap text-[2.9rem] sm:text-[4.4rem] lg:text-[3.9rem] xl:text-[4.7rem]">
            <span className="s-flip block"><span>Your face.</span></span>
            <span className="s-flip block"><span style={{ animationDelay: '120ms' }}>Your voice.</span></span>
            <span className="s-flip block"><span style={{ animationDelay: '240ms' }}>Your <span className="text-[var(--accent)]">agent</span><span className="text-[var(--accent)]">.</span></span></span>
          </h1>
          <p className="s-fade mt-7 max-w-[34rem] text-[18px] leading-relaxed text-[var(--muted)] sm:text-[19px]" style={{ animationDelay: '300ms' }}>
            Upload a short video of yourself and get an AI avatar. Describe the agent you need, out loud. Then let it hold
            live conversations with your face and your voice.
          </p>
          <div className="s-fade mt-9 flex flex-wrap gap-3" style={{ animationDelay: '380ms' }}>
            <Btn to="/signup">Create your avatar</Btn>
          </div>
        </div>
        <div className="s-fade" style={{ animationDelay: '200ms' }}>
          <HeroStage />
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────── scroll story: a 3D prism ───────────────────────── */

const STEPS = [
  { title: 'Upload a short video', body: 'Film yourself facing the camera in good light. Rooman Agent builds your avatar from it.' },
  { title: 'Describe your agent', body: 'Say out loud what the agent should do. Your description becomes its instructions.' },
  { title: 'Go live', body: 'Your agent holds live conversations with your face and your voice.' },
]

function Corners() {
  const c = 'absolute size-7 border-white'
  return (
    <>
      <span className={cn(c, 'left-5 top-5 border-l-[3px] border-t-[3px]')} />
      <span className={cn(c, 'right-5 top-5 border-r-[3px] border-t-[3px]')} />
      <span className={cn(c, 'bottom-5 left-5 border-b-[3px] border-l-[3px]')} />
      <span className={cn(c, 'bottom-5 right-5 border-b-[3px] border-r-[3px]')} />
    </>
  )
}

function Faces() {
  return [
    <div key="0" className="relative size-full">
      <img src="/avatars/clips/aria_rest.jpg" alt="" className="size-full object-cover" />
      <div aria-hidden><Corners /></div>
      <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--ink)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--on-ink)]">Recording · 0:12</span>
    </div>,
    <div key="1" className="flex size-full flex-col justify-between bg-[var(--bg)] p-5 sm:p-8">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--muted)]">You said</p>
        <p className="mt-2 font-display text-[15px] font-bold leading-snug [font-stretch:104%] sm:mt-3 sm:text-[22px] sm:[font-stretch:108%]">“{BUILDER_EXAMPLE[0].text}”</p>
      </div>
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--muted)]">The builder fills in</p>
        <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
          {BUILDER_SLOTS.map(([t]) => (
            <span key={t} className="rounded-full border border-[var(--ink)] px-2.5 py-0.5 text-[12px] font-semibold sm:px-3 sm:py-1 sm:text-[13px]">{t}</span>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-[var(--muted)]">Illustrative example</p>
      </div>
    </div>,
    <div key="2" className="relative size-full">
      <img src="/avatars/clips/shalya_rest.jpg" alt="" className="size-full object-cover" />
      <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--on-ink)]">
        <span className="size-2 rounded-full bg-[var(--accent)]" aria-hidden /> Live
      </span>
      <span className="absolute inset-x-5 bottom-5 rounded-2xl bg-[var(--bg)] px-4 py-3 text-[14px] font-medium leading-snug">
        “Hi, I can answer your questions and book a meeting for you.”
      </span>
    </div>,
  ]
}

export function ScrollStory() {
  const reduced = useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)
  const prismRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [depth, setDepth] = useState(0)

  useEffect(() => {
    if (reduced) return
    const section = sectionRef.current!
    const prism = prismRef.current!
    let raf = 0
    const measure = () => setDepth(prism.offsetWidth / (2 * Math.tan(Math.PI / 3)))
    const update = () => {
      raf = 0
      const r = section.getBoundingClientRect()
      const span = section.offsetHeight - window.innerHeight
      const p = Math.max(0, Math.min(1, -r.top / Math.max(1, span)))
      const x = p * 2
      const base = Math.min(1, Math.floor(x))
      const f = x - base
      // dwell on each face, turn quickly between them
      const e = f <= 0.3 ? 0 : f >= 0.7 ? 1 : (1 - Math.cos(((f - 0.3) / 0.4) * Math.PI)) / 2
      const turn = Math.min(2, base + e)
      prism.style.setProperty('--turn', `${-turn * 120}deg`)
      setActive(Math.round(turn))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    const ro = new ResizeObserver(() => {
      measure()
      update()
    })
    ro.observe(prism)
    window.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [reduced])

  const goTo = (i: number) => {
    const s = sectionRef.current
    if (!s) return
    const span = s.offsetHeight - window.innerHeight
    window.scrollTo({ top: s.offsetTop + (span * i) / 2 + 2, behavior: 'smooth' })
  }

  if (reduced) {
    return (
      <section id="story" aria-labelledby="story-title" className="s-section bg-[var(--surface)]">
        <div className="s-wrap">
          <p className="s-kicker">How it works</p>
          <h2 id="story-title" className="s-h2 mt-4">From a short video to a live agent</h2>
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {Faces().map((face, i) => (
              <li key={i} className="s-card overflow-hidden !bg-[var(--bg)]">
                <div className="aspect-[4/5]">{face}</div>
                <div className="p-6">
                  <h3 className="font-display text-[20px] font-bold">{i + 1}. {STEPS[i].title}</h3>
                  <p className="mt-2 text-[var(--muted)]">{STEPS[i].body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    )
  }

  return (
    <section ref={sectionRef} id="story" aria-labelledby="story-title" className="relative h-[300vh] bg-[var(--surface)]">
      <div className="sticky top-[72px] flex h-[calc(100vh-72px)] items-center overflow-hidden py-6">
        <div className="s-wrap grid w-full items-center gap-6 md:grid-cols-[1fr_1fr] md:gap-12">
          <div>
            <p className="s-kicker">How it works</p>
            <h2 id="story-title" className="s-h2 mt-3 !text-[clamp(1.9rem,1.2rem+2.2vw,3.1rem)] md:mt-4">From a short video to a live agent</h2>
            <ol className="mt-5 space-y-1 md:mt-8">
              {STEPS.map((s, i) => (
                <li key={s.title} className={cn(i !== active && 'hidden md:block')}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={i === active ? 'step' : undefined}
                    className={cn('group flex w-full gap-5 rounded-2xl p-1 text-left transition-opacity md:px-3 md:py-2.5', i === active ? 'opacity-100' : 'opacity-40 hover:opacity-70')}
                  >
                    <span className={cn('font-display text-[34px] font-extrabold leading-none [font-stretch:118%] md:text-[44px]', i === active ? 'text-[var(--ink)]' : '')}>{i + 1}</span>
                    <span>
                      <span className="block font-display text-[20px] font-bold [font-stretch:108%] md:text-[24px]">{s.title}</span>
                      <span className={cn('mt-1 block text-[15px] leading-relaxed text-[var(--muted)] md:text-[16px]', i !== active && 'md:hidden')}>{s.body}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="s-prism-scene mx-auto w-[min(72vw,340px)] md:w-[min(34vw,400px)]">
            <div ref={prismRef} className="s-prism aspect-[4/5] w-full" style={{ transform: `translateZ(${-depth}px) rotateY(var(--turn, 0deg))` }}>
              {Faces().map((face, i) => (
                <div key={i} className="s-prism-face" style={{ transform: `rotateY(${i * 120}deg) translateZ(${depth}px)` }} aria-hidden={i !== active}>
                  {face}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────── use cases: 3D coverflow ───────────────────────── */

export function UseCases({ heading = true }: { heading?: boolean }) {
  const [active, setActive] = useState(0)
  const reduced = useReducedMotion()
  const [stageRef, onScreen] = useOnScreen<HTMLDivElement>()
  const n = USE_CASES.length
  const go = (d: number) => setActive((a) => (a + d + n) % n)

  // keep turning to the next card every few seconds while it's on screen
  // (restarts the timer after a manual move, so a click never jumps straight on)
  useEffect(() => {
    if (reduced || !onScreen) return
    const id = window.setInterval(() => setActive((a) => (a + 1) % n), 3200)
    return () => window.clearInterval(id)
  }, [reduced, onScreen, n, active])

  return (
    <section id="use-cases" aria-labelledby={heading ? 'cases-title' : undefined} aria-label={heading ? undefined : 'Use cases'} className="s-section overflow-hidden bg-[var(--surface)]">
      <div className="s-wrap">
        {heading && (
          <Reveal className="text-center">
            <p className="s-kicker">Use cases</p>
            <h2 id="cases-title" className="s-h2 mx-auto mt-4 max-w-[18ch]">One avatar. As many agents as you need.</h2>
          </Reveal>
        )}
        <div
          ref={stageRef}
          className="s-cover relative mx-auto mt-14 h-[380px] max-w-[1000px] sm:h-[440px]"
          role="region"
          aria-roledescription="carousel"
          aria-label="Use cases"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(1)
            if (e.key === 'ArrowLeft') go(-1)
          }}
        >
          {USE_CASES.map((u, i) => {
            let off = i - active
            if (off > n / 2) off -= n
            if (off < -n / 2) off += n
            const abs = Math.abs(off)
            return (
              <button
                key={u.title}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`${u.title}${i === active ? ' (shown)' : ''}`}
                className="s-cover-card h-[340px] w-[260px] overflow-hidden rounded-[24px] border border-[var(--ink)] bg-[var(--ink)] text-left sm:h-[400px] sm:w-[320px]"
                style={{
                  transform: `translateX(calc(-50% + ${off * 68}%)) translateZ(${-abs * 160}px) rotateY(${-off * 34}deg)`,
                  zIndex: 10 - abs,
                  opacity: abs > 1.5 ? 0 : 1,
                  filter: abs ? 'saturate(0.6) brightness(0.85)' : 'none',
                  pointerEvents: abs > 1.5 ? 'none' : 'auto',
                }}
              >
                <Photo name={u.photo} sizes="320px" />
                <span className="absolute inset-x-3 bottom-3 rounded-2xl bg-[var(--bg)] px-4 py-3 font-display text-[19px] font-bold [font-stretch:108%]">{u.title}</span>
              </button>
            )
          })}
        </div>
        <div className="mx-auto mt-8 flex max-w-xl flex-col items-center text-center">
          <p aria-live="polite" className="min-h-[3.5em] text-[17px] leading-relaxed text-[var(--muted)]">{USE_CASES[active].body}</p>
          <div className="mt-5 flex gap-3">
            <button type="button" onClick={() => go(-1)} aria-label="Previous use case" className="grid size-12 place-items-center rounded-full border-[1.5px] border-[var(--ink)] transition-colors hover:bg-[var(--ink)] hover:text-[var(--on-ink)]"><ArrowLeft className="size-5" /></button>
            <button type="button" onClick={() => go(1)} aria-label="Next use case" className="grid size-12 place-items-center rounded-full border-[1.5px] border-[var(--ink)] transition-colors hover:bg-[var(--ink)] hover:text-[var(--on-ink)]"><ArrowRight className="size-5" /></button>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────── FAQ ───────────────────────── */

export function Faq({ heading = true }: { heading?: boolean }) {
  return (
    <section id="faq" aria-labelledby={heading ? 'faq-title' : undefined} aria-label={heading ? undefined : 'Questions and answers'} className={cn('s-section', heading && 'border-t border-[var(--border)]')}>
      <div className={cn('s-wrap grid gap-10', heading && 'lg:grid-cols-[1fr_1.5fr] lg:gap-16')}>
        {heading && (
          <Reveal>
            <p className="s-kicker">FAQ</p>
            <h2 id="faq-title" className="s-h2 mt-4">Questions, answered</h2>
          </Reveal>
        )}
        <Reveal className="s-faq border-t border-[var(--ink)]">
          {FAQ.map((f, i) => (
            <details key={f.q} open={i === 0} className="border-b border-[var(--border)]">
              <summary className="flex items-center justify-between gap-6 py-5 text-[17px] font-semibold sm:text-[18px]">
                {f.q}
                <span className="s-faq-icon grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] border-[var(--ink)]"><Plus className="size-4" aria-hidden /></span>
              </summary>
              <p className="pb-6 pr-12 text-[16px] leading-relaxed text-[var(--muted)]">{f.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

/* ───────────────────────── final call to action ───────────────────────── */

export function Cta() {
  return (
    <section aria-labelledby="cta-title" className="pb-24">
      <div className="s-wrap">
        <Reveal>
          <Tilt3D max={3}>
            <div className="relative overflow-hidden rounded-[28px] border border-[var(--ink)] bg-[var(--ink)] px-6 py-16 text-[var(--on-ink)] sm:px-14 sm:py-20">
              <span className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-[var(--accent)] [transform:translateZ(30px)]" aria-hidden />
              <h2 id="cta-title" className="s-display relative max-w-[14ch] text-[2.6rem] !text-[var(--on-ink)] sm:text-[4rem]">Your digital twin is one video away.</h2>
              <p className="relative mt-5 max-w-lg text-[18px] text-[var(--on-ink)]/85">Create your avatar, build your first agent, and hold your first live conversation.</p>
              <div className="relative mt-9 flex flex-wrap gap-3">
                <Link to="/signup" className="s-btn bg-[var(--bg)] text-[var(--ink)] shadow-[0_4px_0_var(--ink-edge)] hover:-translate-y-0.5">
                  Create your avatar <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link to="/signin" className="s-btn border-[var(--on-ink)]/60 !text-[var(--on-ink)] hover:bg-[var(--on-ink)]/10">Sign in</Link>
              </div>
            </div>
          </Tilt3D>
        </Reveal>
      </div>
    </section>
  )
}

/* ───────────────────────── footer ───────────────────────── */

export function StudioFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="s-wrap grid gap-10 py-14 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-[var(--muted)]">
            Your face, your voice, your agent. Create an AI avatar, build an agent by talking, and go live.
          </p>
        </div>
        <div>
          <p className="text-[13px] font-bold uppercase tracking-wider">Product</p>
          <ul className="mt-4 space-y-2.5 text-[14.5px] text-[var(--muted)]">
            {NAV.map((l) => <li key={l.href}><Link to={l.href} className="hover:text-[var(--accent)]">{l.label}</Link></li>)}
          </ul>
        </div>
        <div>
          <p className="text-[13px] font-bold uppercase tracking-wider">Account</p>
          <ul className="mt-4 space-y-2.5 text-[14.5px] text-[var(--muted)]">
            <li><Link to="/signup" className="hover:text-[var(--accent)]">Create an account</Link></li>
            <li><Link to="/signin" className="hover:text-[var(--accent)]">Sign in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--border)]">
        <div className="s-wrap py-6 text-[12.5px] text-[var(--muted)]">© {new Date().getFullYear()} Rooman Agent. All rights reserved.</div>
      </div>
    </footer>
  )
}
