import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Check, FileText, LayoutDashboard, MessageSquare, Radio, RotateCcw, ScanFace } from 'lucide-react'
import { cn } from '@/lib/cn'
import { BUILDER_EXAMPLE, BUILDER_SLOTS } from '../editorial/content'

/* ───────── helpers ───────── */

function useReduced() {
  const [r] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  return r
}

/** A counter that ticks every `ms` up to `max` while `on` (starts at `max` with reduced motion).
    To restart it, remount the component that uses it (a new React `key`). */
function useTicker(on: boolean, ms: number, max: number) {
  const reduced = useReduced()
  const [n, setN] = useState(() => (reduced ? max : 0))
  useEffect(() => {
    if (!on || reduced) return
    const id = window.setInterval(() => setN((v) => (v >= max ? v : v + 1)), ms)
    return () => window.clearInterval(id)
  }, [on, ms, max, reduced])
  return n
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--muted)] ring-1 ring-[var(--border)]">{children}</span>
}

/* ───────── previews (one per feature) ───────── */

const PIPELINE = ['Ingest', 'Train', 'Generate', 'Check']

function AvatarPreview({ active }: { active: boolean }) {
  const step = useTicker(active, 1100, PIPELINE.length)
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (active) v.play().catch(() => {})
    else v.pause()
  }, [active])
  return (
    <div className="grid h-full gap-4 sm:grid-cols-[1fr_0.9fr]">
      <div className="relative min-h-[260px] overflow-hidden rounded-2xl bg-[var(--ink)]">
        <video
          ref={videoRef}
          src="/avatars/clips/shalya_intro.mp4"
          poster="/avatars/clips/shalya_rest.jpg"
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="Shalya, an AI avatar built from a short video, speaking"
          className="absolute inset-0 size-full object-cover"
        />
        <span className="absolute left-3 top-3 rounded-full bg-[var(--bg)]/95 px-2.5 py-1 text-[12px] font-semibold text-[var(--ink)]">Generated, not recorded</span>
      </div>
      <ol className="flex flex-col justify-center gap-2.5">
        {PIPELINE.map((p, i) => {
          const done = i < step
          const now = i === step
          return (
            <li
              key={p}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-all duration-500',
                done ? 'border-[var(--accent)]/40 bg-[var(--bg)]' : now ? 'border-[var(--ink)] bg-[var(--bg)] shadow-[0_8px_20px_-14px_rgba(29,58,154,0.7)]' : 'border-[var(--border)] bg-transparent opacity-60',
              )}
            >
              <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-bold', done ? 'bg-[var(--accent)] text-[var(--on-ink)]' : 'bg-[var(--surface)] text-[var(--ink)] ring-1 ring-[var(--border)]')}>
                {done ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span className="text-[14.5px] font-semibold text-[var(--ink)]">{p}</span>
              {p === 'Check' && <span className="ml-auto text-[12px] text-[var(--muted)]">every frame vs. your face</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function BuilderPreview({ active }: { active: boolean }) {
  const [run, setRun] = useState(0)
  return <BuilderRun key={run} active={active} onReplay={() => setRun((r) => r + 1)} />
}

function BuilderRun({ active, onReplay }: { active: boolean; onReplay: () => void }) {
  const total = BUILDER_EXAMPLE.length + BUILDER_SLOTS.length
  const n = useTicker(active, 900, total)
  const msgs = Math.min(n, BUILDER_EXAMPLE.length)
  const slots = Math.max(0, n - BUILDER_EXAMPLE.length)
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex-1 space-y-2.5 rounded-2xl bg-[var(--bg)] p-4 ring-1 ring-[var(--border)]" aria-live="polite">
        {BUILDER_EXAMPLE.slice(0, msgs).map((m, i) => (
          <div
            key={i}
            className={cn(
              'max-w-[88%] animate-fade-up rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed',
              m.who === 'You' ? 'ml-auto rounded-br-md bg-[var(--ink)] text-[var(--on-ink)]' : 'rounded-bl-md bg-[var(--surface)] text-[var(--ink)] ring-1 ring-[var(--border)]',
            )}
          >
            {m.text}
          </div>
        ))}
        {msgs < BUILDER_EXAMPLE.length && (
          <div className="flex gap-1 px-1 py-2" aria-hidden>
            {[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-pulse-soft rounded-full bg-[var(--muted)]" style={{ animationDelay: `${i * 150}ms` }} />)}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[12.5px] font-semibold text-[var(--muted)]">Agent spec:</span>
        {BUILDER_SLOTS.map(([t], i) => (
          <span
            key={t}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12.5px] font-semibold transition-all duration-500',
              i < slots ? 'bg-[var(--accent)] text-[var(--on-ink)]' : 'text-[var(--muted)] ring-1 ring-[var(--border)]',
            )}
          >
            {i < slots && <Check className="size-3.5" aria-hidden />}
            {t}
          </span>
        ))}
        <button type="button" onClick={onReplay} className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold text-[var(--accent)] hover:bg-[var(--bg)]">
          <RotateCcw className="size-3.5" aria-hidden /> Replay
        </button>
      </div>
    </div>
  )
}

const LIVE_STATES = [
  { label: 'Listening', text: 'Speech is transcribed as the caller talks.' },
  { label: 'Thinking', text: 'It follows your conversation flow and documents.' },
  { label: 'Speaking', text: 'The reply comes back in your avatar’s face and voice.' },
]

function LivePreview({ active }: { active: boolean }) {
  const reduced = useReduced()
  const [s, setS] = useState(0)
  useEffect(() => {
    if (!active || reduced) return
    const id = window.setInterval(() => setS((v) => (v + 1) % LIVE_STATES.length), 1800)
    return () => window.clearInterval(id)
  }, [active, reduced])
  return (
    <div className="grid h-full gap-4 sm:grid-cols-[1fr_0.9fr]">
      <div className="relative min-h-[260px] overflow-hidden rounded-2xl bg-[var(--ink)]">
        <img src="/avatars/clips/aria_rest.jpg" alt="Aria, an AI avatar, in a live conversation" className="absolute inset-0 size-full object-cover" loading="lazy" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-[var(--bg)]/95 px-2.5 py-1 text-[12px] font-semibold text-[var(--ink)]">
          <span className="size-2 animate-pulse-soft rounded-full bg-[var(--accent)]" aria-hidden /> Live
        </span>
        <div className="absolute inset-x-3 bottom-3 flex h-10 items-center justify-center gap-[3px] rounded-xl bg-[var(--bg)]/95 px-3" aria-hidden>
          {Array.from({ length: 22 }, (_, i) => (
            <span
              key={i}
              className={cn('w-[3px] rounded-full bg-[var(--accent)]', s === 1 ? 'h-1' : 'animate-wave')}
              style={{ height: s === 1 ? undefined : `${30 + ((i * 37) % 60)}%`, animationDelay: `${(i % 7) * 90}ms` }}
            />
          ))}
        </div>
      </div>
      <ol className="flex flex-col justify-center gap-2.5">
        {LIVE_STATES.map((st, i) => (
          <li key={st.label}>
            <button
              type="button"
              onClick={() => setS(i)}
              aria-pressed={i === s}
              className={cn('w-full rounded-xl border px-3.5 py-3 text-left transition-all duration-300', i === s ? 'border-[var(--ink)] bg-[var(--bg)] shadow-[0_8px_20px_-14px_rgba(29,58,154,0.7)]' : 'border-[var(--border)] opacity-60 hover:opacity-90')}
            >
              <span className="block text-[14.5px] font-semibold text-[var(--ink)]">{st.label}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-[var(--muted)]">{st.text}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

const DOCS = ['Services overview.pdf', 'Pricing.pdf', 'Opening hours.docx']
const QA = [
  { q: 'What services do you offer?', a: 'We offer three plans: Starter, Team and Enterprise. I can walk you through any of them.', src: 'Services overview.pdf' },
  { q: 'How much is the Team plan?', a: 'The Team plan is billed monthly per seat. I can send you the full price list.', src: 'Pricing.pdf' },
  { q: 'Are you open on Saturday?', a: 'Yes, from 10 am to 2 pm. Would you like to book a time?', src: 'Opening hours.docx' },
]

function DocsPreview() {
  const [q, setQ] = useState(0)
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {DOCS.map((d) => (
          <span key={d} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors', QA[q].src === d ? 'bg-[var(--ink)] text-[var(--on-ink)]' : 'bg-[var(--bg)] text-[var(--ink)] ring-1 ring-[var(--border)]')}>
            <FileText className="size-3.5" aria-hidden /> {d}
          </span>
        ))}
      </div>
      <div className="flex-1 rounded-2xl bg-[var(--bg)] p-4 ring-1 ring-[var(--border)]">
        <p className="text-[12px] font-semibold text-[var(--muted)]">Ask the agent</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {QA.map((x, i) => (
            <button
              key={x.q}
              type="button"
              onClick={() => setQ(i)}
              aria-pressed={i === q}
              className={cn('rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors', i === q ? 'bg-[var(--accent)] text-[var(--on-ink)]' : 'text-[var(--ink)] ring-1 ring-[var(--border)] hover:ring-[var(--ink)]')}
            >
              {x.q}
            </button>
          ))}
        </div>
        <div key={q} className="mt-4 animate-fade-up space-y-2.5" aria-live="polite">
          <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[var(--ink)] px-3.5 py-2.5 text-[14px] text-[var(--on-ink)]">{QA[q].q}</div>
          <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-[var(--border)]">
            {QA[q].a}
            <span className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--accent)]">
              <BookOpen className="size-3.5" aria-hidden /> Source: {QA[q].src}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

const AGENTS = [
  { name: 'Receptionist', avatar: 'Shalya', status: 'Live' },
  { name: 'Sales representative', avatar: 'Aria', status: 'Live' },
  { name: 'Support agent', avatar: 'Shalya', status: 'Draft' },
]

function WorkspacePreview({ active }: { active: boolean }) {
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    if (!active) return
    const id = window.setTimeout(() => setGrown(true), 120)
    return () => window.clearTimeout(id)
  }, [active])
  const bars = [
    { label: 'Render-minutes', used: 42, of: 100 },
    { label: 'Conversation-minutes', used: 68, of: 100 },
  ]
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="overflow-hidden rounded-2xl bg-[var(--bg)] ring-1 ring-[var(--border)]">
        <div className="grid grid-cols-[1.4fr_1fr_auto] gap-3 border-b border-[var(--border)] px-4 py-2.5 text-[12px] font-semibold text-[var(--muted)]">
          <span>Agent</span><span>Avatar</span><span>Status</span>
        </div>
        {AGENTS.map((a) => (
          <div key={a.name} className="grid grid-cols-[1.4fr_1fr_auto] items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-[14px] last:border-0 hover:bg-[var(--surface)]">
            <span className="font-semibold text-[var(--ink)]">{a.name}</span>
            <span className="text-[var(--muted)]">{a.avatar}</span>
            <span className={cn('rounded-full px-2.5 py-0.5 text-[12px] font-semibold', a.status === 'Live' ? 'bg-[var(--accent)] text-[var(--on-ink)]' : 'text-[var(--muted)] ring-1 ring-[var(--border)]')}>{a.status}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {bars.map((b) => (
          <div key={b.label} className="rounded-2xl bg-[var(--bg)] p-4 ring-1 ring-[var(--border)]">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-semibold text-[var(--ink)]">{b.label}</span>
              <span className="text-[var(--muted)]">{b.used} / {b.of}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface)] ring-1 ring-[var(--border)]">
              <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-1000 ease-out" style={{ width: grown ? `${(b.used / b.of) * 100}%` : '0%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────── the explorer ───────── */

const FEATURES = [
  {
    id: 'avatar',
    icon: ScanFace,
    title: 'An avatar from one video',
    body: 'Record in your browser or upload a short clip. You confirm consent, then Rooman Agent builds a reusable digital twin with your voice cloned alongside it.',
    points: ['Face, body and voice from one video', 'Every generated frame checked against your face'],
  },
  {
    id: 'builder',
    icon: MessageSquare,
    title: 'Build an agent by talking',
    body: 'Describe the agent you need, out loud. The builder asks what’s missing and turns the conversation into a conversation flow and a ready-to-deploy agent spec.',
    points: ['Purpose, callers, workflow, tools, language', 'Speak or type — no forms to fill in'],
  },
  {
    id: 'live',
    icon: Radio,
    title: 'Live conversations',
    body: 'Your agent holds real-time voice and video conversations in your avatar’s face and voice, following the flow you designed.',
    points: ['Listens, thinks and speaks in real time', 'The same face in every conversation'],
  },
  {
    id: 'docs',
    icon: BookOpen,
    title: 'Answers from your documents',
    body: 'Add reference documents while you build. The agent answers from them during conversations, so replies stay grounded in your own material.',
    points: ['Upload files while building', 'Answers come from your material'],
  },
  {
    id: 'workspace',
    icon: LayoutDashboard,
    title: 'One workspace',
    body: 'Every avatar and agent with its status in one list, plus render-minutes and conversation-minutes so you can plan capacity and cost.',
    points: ['All agents and their status', 'Usage tracked as you go'],
  },
] as const

export function FeatureExplorer({ heading = true }: { heading?: boolean }) {
  const [active, setActive] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const f = FEATURES[active]

  const onKey = (e: KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
    if (!(e.key in keys) && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const n = FEATURES.length
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (active + keys[e.key] + n) % n
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <section id="features" aria-labelledby={heading ? 'features-title' : undefined} aria-label={heading ? undefined : 'Features'} className={cn('s-section', !heading && 'pt-4 lg:pt-6')}>
      <div className="s-wrap">
        {heading && <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="s-kicker">Features</p>
            <h2 id="features-title" className="s-h2 mt-4">One recording, many conversations</h2>
            <p className="mt-5 text-[17px] leading-relaxed text-[var(--muted)]">
              Everything you need to turn a short video into an agent that talks for you. Pick a feature to see it in action.
            </p>
          </div>
          <Link to="/signup" className="s-btn s-btn-ink">
            Start building <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>}

        <div className={cn('grid gap-6 lg:grid-cols-[0.95fr_1.25fr] lg:gap-8', heading && 'mt-12')}>
          {/* feature cards = tabs */}
          <div role="tablist" aria-label="Features" aria-orientation="vertical" onKeyDown={onKey} className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:pb-0">
            {FEATURES.map((ft, i) => {
              const on = i === active
              return (
                <button
                  key={ft.id}
                  ref={(el) => {
                    tabRefs.current[i] = el
                  }}
                  type="button"
                  role="tab"
                  id={`feat-tab-${ft.id}`}
                  aria-selected={on}
                  aria-controls="feat-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => setActive(i)}
                  className={cn(
                    'group relative shrink-0 rounded-2xl border p-4 text-left transition-all duration-300 lg:p-5',
                    'w-[240px] lg:w-auto',
                    on
                      ? 'border-[var(--ink)] bg-[var(--bg)] shadow-[0_18px_40px_-26px_rgba(29,58,154,0.8)] lg:translate-x-1.5'
                      : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50 hover:bg-[var(--bg)]',
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl transition-colors', on ? 'bg-[var(--ink)] text-[var(--on-ink)]' : 'bg-[var(--bg)] text-[var(--ink)] ring-1 ring-[var(--border)]')}>
                      <ft.icon className="size-5" aria-hidden />
                    </span>
                    <span className="font-display text-[17px] font-bold leading-tight text-[var(--ink)] [font-stretch:106%]">{ft.title}</span>
                    <ArrowRight className={cn('ml-auto hidden size-4 shrink-0 text-[var(--accent)] transition-all lg:block', on ? 'opacity-100' : 'opacity-0 group-hover:translate-x-1 group-hover:opacity-60')} aria-hidden />
                  </span>
                  <span className={cn('hidden overflow-hidden text-[14px] leading-relaxed text-[var(--muted)] transition-all duration-500 lg:grid', on ? 'mt-3 grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                    <span className="min-h-0">{ft.body}</span>
                  </span>
                  {on && <span className="absolute inset-y-4 left-0 hidden w-[3px] rounded-full bg-[var(--accent)] lg:block" aria-hidden />}
                </button>
              )
            })}
          </div>

          {/* live preview */}
          <div id="feat-panel" role="tabpanel" aria-labelledby={`feat-tab-${f.id}`} className="s-card flex min-h-[460px] flex-col p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-[22px] font-bold text-[var(--ink)] [font-stretch:108%]">{f.title}</h3>
                <p className="mt-1.5 max-w-xl text-[14.5px] leading-relaxed text-[var(--muted)] lg:hidden">{f.body}</p>
                <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                  {f.points.map((p) => (
                    <li key={p} className="flex items-center gap-1.5 text-[13.5px] text-[var(--ink)]">
                      <Check className="size-4 text-[var(--accent)]" aria-hidden /> {p}
                    </li>
                  ))}
                </ul>
              </div>
              {(f.id === 'builder' || f.id === 'docs' || f.id === 'workspace') && <Tag>Illustrative example</Tag>}
            </div>
            <div key={f.id} className="mt-5 flex-1 animate-fade-up">
              {f.id === 'avatar' && <AvatarPreview active />}
              {f.id === 'builder' && <BuilderPreview active />}
              {f.id === 'live' && <LivePreview active />}
              {f.id === 'docs' && <DocsPreview />}
              {f.id === 'workspace' && <WorkspacePreview active />}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
