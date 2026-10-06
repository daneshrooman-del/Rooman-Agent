import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, AudioLines, BookOpen, Bot, Captions, Check, ChevronDown, Clapperboard, Database, FileText,
  GraduationCap, Headset, LayoutDashboard, MessageSquare, Mic, Phone, Plus, Radio, ScanFace, Search,
  ShieldCheck, Sparkles, Upload, UserRound, Users, Video, Wand2,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { PageIntro, StudioLayout } from '@/components/landing/studio/Layout'
import { Photo, Reveal } from '@/components/landing/studio/Sections'
import { Tilt3D } from '@/components/landing/editorial/Tilt3D'
import type { PhotoKey } from '@/components/landing/editorial/content'
import { Orbit, Prism } from './how3d'
import { AVATAR_FACES, BUILDER_FACES } from './how3dFaces'
import { useAutoStep } from './how3dHooks'

/* ════════════════════════ shared page pieces ════════════════════════ */

type TocItem = { id: string; label: string }

/** Sticky in-page menu that highlights the section in view. Side column on desktop, chip row on mobile. */
function PageToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id)
  // the active entry is the last section whose top has passed 35% of the viewport (the first one before that)
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const line = window.innerHeight * 0.35
      let cur = items[0]?.id
      for (const i of items) {
        const el = document.getElementById(i.id)
        if (el && el.getBoundingClientRect().top <= line) cur = i.id
      }
      setActive(cur)
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
  }, [items])
  return (
    <>
      <nav aria-label="On this page" className="sticky top-[72px] z-30 -mx-5 mb-8 overflow-x-auto border-b border-[var(--border)] bg-[var(--bg)]/95 px-5 py-3 backdrop-blur-sm [scrollbar-width:none] lg:hidden">
        <ul className="flex gap-2">
          {items.map((i) => (
            <li key={i.id}>
              <a href={`#${i.id}`} className={cn('block whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors', active === i.id ? 'bg-[var(--ink)] text-[var(--on-ink)]' : 'text-[var(--muted)] ring-1 ring-[var(--border)]')}>
                {i.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label="On this page" className="sticky top-[104px] hidden self-start lg:block">
        <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted)]">On this page</p>
        <ul className="mt-4 space-y-1 border-l border-[var(--border)]">
          {items.map((i) => (
            <li key={i.id}>
              <a
                href={`#${i.id}`}
                aria-current={active === i.id ? 'true' : undefined}
                className={cn('-ml-px block border-l-2 py-1.5 pl-4 text-[14.5px] transition-colors', active === i.id ? 'border-[var(--accent)] font-semibold text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]')}
              >
                {i.label}
              </a>
            </li>
          ))}
        </ul>
        <Link to="/signup" className="s-btn s-btn-primary s-btn-sm mt-8">Get started</Link>
      </nav>
    </>
  )
}

/** Page body with the in-page menu beside it. */
function WithToc({ items, children }: { items: TocItem[]; children: ReactNode }) {
  return (
    <div className="s-wrap pb-24 pt-8 lg:grid lg:grid-cols-[200px_1fr] lg:gap-14 lg:pt-16">
      <PageToc items={items} />
      <div className="min-w-0 space-y-24 lg:space-y-28">{children}</div>
    </div>
  )
}

function Block({ id, kicker, title, lead, children }: { id: string; kicker: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-[140px] lg:scroll-mt-[104px]">
      <Reveal>
        <p className="s-kicker">{kicker}</p>
        <h2 id={`${id}-title`} className="s-h2 mt-4 max-w-[20ch] !text-[clamp(1.9rem,1.2rem+2.4vw,3rem)]">{title}</h2>
        {lead && <p className="mt-5 max-w-2xl text-[17.5px] leading-relaxed text-[var(--muted)]">{lead}</p>}
      </Reveal>
      <div className="mt-10">{children}</div>
    </section>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((t) => (
        <li key={t} className="flex gap-2.5 text-[15px] leading-snug text-[var(--ink)]">
          <Check className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" aria-hidden /> {t}
        </li>
      ))}
    </ul>
  )
}

function Chip({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold', strong ? 'bg-[var(--ink)] text-[var(--on-ink)]' : 'bg-[var(--bg)] text-[var(--ink)] ring-1 ring-[var(--border)]')}>
      {children}
    </span>
  )
}

/* ════════════════════════ HOW IT WORKS ════════════════════════ */

const AVATAR_STEPS = [
  { icon: Upload, title: 'Record or upload', body: 'Film yourself in the browser or upload a clip. Face the camera in good light and talk naturally. You confirm consent before anything is trained.' },
  { icon: ScanFace, title: 'Ingest', body: 'The engine finds your face and body, removes the background and pulls out clean audio from the recording.' },
  { icon: Sparkles, title: 'Train', body: 'Everything is packaged into one reusable digital twin, with your voice cloned alongside it.' },
  { icon: Clapperboard, title: 'Generate', body: 'Give it a script or an audio clip and it renders a video of your twin talking, greeting or demonstrating.' },
  { icon: ShieldCheck, title: 'Consistency check', body: 'Every generated frame is compared with your original face. Frames that drift into looking like someone else are flagged or rejected.' },
]

const BUILDER_STEPS = [
  { icon: Mic, title: 'A live session', body: 'You talk to the builder in a real-time voice and video session. Your speech is transcribed as you go.' },
  { icon: MessageSquare, title: 'Slot-filling', body: 'From free-form talk it picks out what it needs — purpose, who will call, what to collect, the workflow, tools and language — and asks a follow-up for anything missing.' },
  { icon: Wand2, title: 'Flow generation', body: 'Your answers become a conversation flow: the states the agent moves through, what it aims to do in each, and how it moves between them.' },
  { icon: BookOpen, title: 'Knowledge base', body: 'Reference documents you add are split, indexed and searched during conversations, so answers come from your material.' },
  { icon: FileText, title: 'Provisioning', body: 'Everything is bundled into one agent spec, with the avatar and voice you pick, ready to deploy.' },
]

const LIVE_STEPS = [
  { icon: AudioLines, title: 'Listens', body: 'The caller’s speech is streamed and transcribed in real time.' },
  { icon: Bot, title: 'Thinks', body: 'The agent follows its conversation flow and looks things up in its knowledge base.' },
  { icon: Video, title: 'Speaks', body: 'The reply is spoken in your cloned voice and shown with your avatar’s face, lip-synced.' },
  { icon: LayoutDashboard, title: 'Tracks', body: 'Conversation-minutes are recorded in your workspace so you can plan capacity and cost.' },
]

function StepRail({ steps, open, setOpen }: { steps: { icon: typeof Upload; title: string; body: string }[]; open: number; setOpen: (i: number) => void }) {
  return (
    <ol className="relative space-y-3 before:absolute before:bottom-6 before:left-[27px] before:top-6 before:w-px before:bg-[var(--border)]">
      {steps.map((s, i) => {
        const on = open === i
        return (
          <li key={s.title} className="relative">
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-expanded={on}
              className={cn('flex w-full items-start gap-4 rounded-2xl border p-3 pr-5 text-left transition-all duration-300', on ? 'border-[var(--ink)] bg-[var(--bg)] shadow-[0_16px_34px_-24px_rgba(29,58,154,0.8)]' : 'border-transparent hover:bg-[var(--surface)]')}
            >
              <span className={cn('relative z-10 grid size-[38px] shrink-0 place-items-center rounded-xl transition-colors', on ? 'bg-[var(--ink)] text-[var(--on-ink)]' : 'bg-[var(--surface)] text-[var(--ink)] ring-1 ring-[var(--border)]')}>
                <s.icon className="size-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 pt-1.5">
                <span className="flex items-baseline gap-2">
                  <span className="text-[12.5px] font-bold text-[var(--accent)]">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-display text-[18px] font-bold [font-stretch:106%]">{s.title}</span>
                </span>
                <span className={cn('grid transition-all duration-500', on ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                  <span className="min-h-0 overflow-hidden text-[15px] leading-relaxed text-[var(--muted)]">{s.body}</span>
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}


function PrismStage({ steps, faces, label, side }: { steps: { icon: typeof Upload; title: string; body: string }[]; faces: ReactNode[]; label: string; side?: ReactNode }) {
  const { ref, i, pick } = useAutoStep(steps.length)
  return (
    <div ref={ref} className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <StepRail steps={steps} open={i} setOpen={pick} />
        {side}
      </div>
      <div className="mx-auto w-full max-w-[400px] lg:sticky lg:top-[120px]">
        <Prism faces={faces} active={i} label={`${label}: ${steps[i].title}`} />
        <p className="mt-4 text-center text-[13px] text-[var(--muted)]">Step {i + 1} of {steps.length} · {steps[i].title}</p>
      </div>
    </div>
  )
}

export function HowItWorksPage() {
  const toc = useMemo(() => [
    { id: 'create', label: '1. Create your avatar' },
    { id: 'build', label: '2. Build your agent' },
    { id: 'live', label: '3. Go live' },
  ], [])
  return (
    <StudioLayout title="How it works — Rooman Agent">
      <PageIntro
        crumb="How it works"
        title="From a short video to a live agent"
        lead="Rooman Agent works in three stages. First it turns a video of you into an avatar. Then it builds an agent from a conversation with you. Finally, that agent holds live conversations with your face and your voice."
      >
        <div className="s-fade mt-8 flex flex-wrap gap-2" style={{ animationDelay: '240ms' }}>
          <Chip strong>1 · Create your avatar</Chip><Chip>2 · Build your agent</Chip><Chip>3 · Go live</Chip>
        </div>
      </PageIntro>
      <WithToc items={toc}>
        <Block id="create" kicker="Stage 1" title="Create your avatar" lead="Your avatar is a digital twin made from a short video of you. It can then say new things — in your voice — without ever looking like someone else.">
          <PrismStage steps={AVATAR_STEPS} faces={AVATAR_FACES} label="Creating an avatar" />
        </Block>
        <Block id="build" kicker="Stage 2" title="Build your agent by talking" lead="Instead of filling in forms, you describe the agent you need in a conversation. The builder works out what’s missing and asks you about it.">
          <PrismStage steps={BUILDER_STEPS} faces={BUILDER_FACES} label="Building an agent" side={
            <div className="s-card mt-6 p-6">
              <p className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--accent)]">The builder listens for</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Purpose', 'Who will call', 'What to collect', 'Workflow steps', 'Tools', 'Language'].map((t) => <Chip key={t}>{t}</Chip>)}
              </div>
              <p className="mt-6 text-[14.5px] leading-relaxed text-[var(--muted)]">
                It never waits for a full transcript. After each thing you say, it updates what it knows and asks one specific follow-up for the next missing detail.
              </p>
            </div>
          } />
        </Block>
        <Block id="live" kicker="Stage 3" title="Go live" lead="Once deployed, your agent takes real conversations — by voice and video — and answers as you, from your material.">
          <Orbit items={LIVE_STEPS} />
        </Block>
      </WithToc>
    </StudioLayout>
  )
}

/* ════════════════════════ FEATURES ════════════════════════ */

const FEATURE_BLOCKS: {
  id: string
  icon: typeof Upload
  kicker: string
  title: string
  lead: string
  points: string[]
  visual: 'img' | 'spec' | 'chat' | 'docs' | 'dash' | 'video'
  img?: string
}[] = [
  {
    id: 'avatar-studio', icon: ScanFace, kicker: 'Avatar studio', title: 'An avatar made from one video',
    lead: 'Record yourself in the browser or upload a clip. Rooman Agent isolates your face, body and voice and builds a digital twin you can reuse everywhere.',
    points: ['Record in the browser or upload a file', 'Consent is confirmed before training', 'Your voice is cloned alongside your face', 'Every generated frame is checked against your original face'],
    visual: 'img', img: '/avatars/clips/aria_rest.jpg',
  },
  {
    id: 'video', icon: Clapperboard, kicker: 'Video generation', title: 'Videos from a script, in your face',
    lead: 'Type a script — or upload an audio clip — and get a video of your avatar saying it. No camera and no reshoots.',
    points: ['Start from a script or your own audio', 'Talking, greeting or demonstrating', 'Lip-sync matched to the speech', 'The same avatar in every video'],
    visual: 'video',
  },
  {
    id: 'builder', icon: MessageSquare, kicker: 'Agent builder', title: 'Build an agent by describing it',
    lead: 'Talk to the builder like you would brief a new hire. It turns the conversation into a conversation flow and a ready-to-deploy agent spec.',
    points: ['Speak or type — no forms', 'Asks about purpose, callers, inputs, workflow, tools and language', 'Generates the conversation flow for you', 'Review the spec and pick an avatar and voice'],
    visual: 'chat',
  },
  {
    id: 'live', icon: Radio, kicker: 'Live conversations', title: 'Real-time conversations as you',
    lead: 'Your agent holds live voice and video conversations, following the flow you designed and replying in your avatar’s face and voice.',
    points: ['Real-time audio and video', 'Speech transcribed as the caller talks', 'Replies in your cloned voice, lip-synced', 'Reach it by phone, on the web or through the API'],
    visual: 'img', img: '/avatars/clips/shalya_rest.jpg',
  },
  {
    id: 'knowledge', icon: BookOpen, kicker: 'Knowledge base', title: 'Answers from your own documents',
    lead: 'Add reference documents while you build. Each agent gets its own knowledge base, searched during conversations so answers come from your material.',
    points: ['Upload documents per agent', 'Split and indexed for search', 'Relevant passages found for each question', 'Keeps answers grounded in what you provided'],
    visual: 'docs',
  },
  {
    id: 'workspace', icon: LayoutDashboard, kicker: 'Workspace', title: 'Everything in one workspace',
    lead: 'All your avatars, videos and agents in one place — with each agent’s status and the usage you need to plan capacity and cost.',
    points: ['A list of all agents and their status', 'Draft, active or disabled', 'Render-minutes and conversation-minutes', 'Assets, videos and analytics'],
    visual: 'dash',
  },
]

function FeatureVisual({ f }: { f: (typeof FEATURE_BLOCKS)[number] }) {
  if (f.visual === 'img')
    return <img src={f.img} alt="" loading="lazy" className="aspect-[4/5] w-full rounded-xl object-cover sm:aspect-[5/4] lg:aspect-[4/5]" />
  if (f.visual === 'video')
    return (
      <video src="/avatars/clips/aria_intro.mp4" poster="/avatars/clips/aria_rest.jpg" muted loop playsInline autoPlay preload="metadata" aria-label="Aria, an AI avatar, presenting a generated script" className="aspect-[4/5] w-full rounded-xl object-cover sm:aspect-[5/4] lg:aspect-[4/5]" />
    )
  if (f.visual === 'chat')
    return (
      <div className="space-y-2.5 p-2">
        {[['You', 'I need an agent that books meetings for our team.'], ['Builder', 'Who will be calling it — customers or partners?'], ['You', 'Customers. In English, please.'], ['Builder', 'Got it. What should it collect before booking?']].map(([w, t], i) => (
          <div key={i} className={cn('max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[14px]', w === 'You' ? 'ml-auto rounded-br-md bg-[var(--ink)] text-[var(--on-ink)]' : 'rounded-bl-md bg-[var(--surface)] text-[var(--ink)] ring-1 ring-[var(--border)]')}>{t}</div>
        ))}
        <p className="pt-1 text-[12px] text-[var(--muted)]">Illustrative example</p>
      </div>
    )
  if (f.visual === 'docs')
    return (
      <div className="space-y-3 p-2">
        {['Services overview.pdf', 'Pricing.pdf', 'Opening hours.docx'].map((d, i) => (
          <div key={d} className="flex items-center gap-3 rounded-xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]">
            <FileText className="size-5 text-[var(--accent)]" aria-hidden />
            <span className="text-[14px] font-semibold">{d}</span>
            <span className="ml-auto text-[12px] text-[var(--muted)]">{['indexed', 'indexed', 'indexing…'][i]}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--accent)]/50 px-4 py-3 text-[13.5px] font-semibold text-[var(--accent)]">
          <Database className="size-4" aria-hidden /> One knowledge base per agent
        </div>
        <p className="text-[12px] text-[var(--muted)]">Illustrative example</p>
      </div>
    )
  if (f.visual === 'dash')
    return (
      <div className="space-y-3 p-2">
        {[['Receptionist', 'Active'], ['Sales representative', 'Active'], ['Support agent', 'Draft']].map(([n, st]) => (
          <div key={n} className="flex items-center justify-between rounded-xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]">
            <span className="text-[14px] font-semibold">{n}</span>
            <span className={cn('rounded-full px-2.5 py-0.5 text-[12px] font-semibold', st === 'Active' ? 'bg-[var(--accent)] text-[var(--on-ink)]' : 'text-[var(--muted)] ring-1 ring-[var(--border)]')}>{st}</span>
          </div>
        ))}
        {[['Render-minutes', 42], ['Conversation-minutes', 68]].map(([l, v]) => (
          <div key={l as string} className="rounded-xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]">
            <div className="flex justify-between text-[13px]"><span className="font-semibold">{l}</span><span className="text-[var(--muted)]">{v} / 100</span></div>
            <div className="mt-2 h-1.5 rounded-full bg-[var(--bg)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${v}%` }} /></div>
          </div>
        ))}
        <p className="text-[12px] text-[var(--muted)]">Example data</p>
      </div>
    )
  return null
}

const COMPARE = [
  { row: 'What it is', video: 'A finished video of your avatar', live: 'A real-time conversation', agent: 'An agent that runs conversations for you' },
  { row: 'You provide', video: 'A script or audio clip', live: 'An agent and its avatar', agent: 'A description, documents and tools' },
  { row: 'Interactive', video: 'No — plays back', live: 'Yes — two-way', agent: 'Yes — follows your flow' },
  { row: 'Usage tracked as', video: 'Render-minutes', live: 'Conversation-minutes', agent: 'Conversation-minutes' },
]

export function FeaturesPage() {
  const toc = useMemo(() => [...FEATURE_BLOCKS.map((f) => ({ id: f.id, label: f.kicker })), { id: 'compare', label: 'Compare' }], [])
  return (
    <StudioLayout title="Features — Rooman Agent">
      <PageIntro crumb="Features" title="Everything Rooman Agent can do" lead="Six building blocks — from making your avatar to running live agents — that work together in one workspace.">
        <div className="s-fade mt-8 flex flex-wrap gap-2" style={{ animationDelay: '240ms' }}>
          {FEATURE_BLOCKS.map((f) => <a key={f.id} href={`#${f.id}`}><Chip>{<f.icon className="size-3.5" aria-hidden />}{f.kicker}</Chip></a>)}
        </div>
      </PageIntro>
      <WithToc items={toc}>
        {FEATURE_BLOCKS.map((f, i) => (
          <section key={f.id} id={f.id} aria-labelledby={`${f.id}-title`} className="scroll-mt-[140px] lg:scroll-mt-[104px]">
            <div className={cn('grid items-center gap-10 lg:grid-cols-2', i % 2 === 1 && 'lg:[&>*:first-child]:order-2')}>
              <Reveal>
                <span className="grid size-12 place-items-center rounded-2xl bg-[var(--ink)] text-[var(--on-ink)]"><f.icon className="size-6" aria-hidden /></span>
                <p className="s-kicker mt-6">{f.kicker}</p>
                <h2 id={`${f.id}-title`} className="s-h2 mt-3 !text-[clamp(1.8rem,1.2rem+2vw,2.7rem)]">{f.title}</h2>
                <p className="mt-5 text-[17px] leading-relaxed text-[var(--muted)]">{f.lead}</p>
                <div className="mt-6"><Bullets items={f.points} /></div>
              </Reveal>
              <Reveal delay={100}>
                <Tilt3D max={6}>
                  <div className="s-card !bg-[var(--bg)] p-3 shadow-[0_30px_60px_-36px_rgba(29,58,154,0.6)]">
                    <FeatureVisual f={f} />
                  </div>
                </Tilt3D>
              </Reveal>
            </div>
          </section>
        ))}
        <Block id="compare" kicker="Compare" title="Video, live or agent?" lead="All three use the same avatar. Here’s how they differ.">
          <div className="s-card overflow-x-auto !bg-[var(--bg)]">
            <table className="w-full min-w-[640px] text-left text-[14.5px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th scope="col" className="px-5 py-4 font-semibold text-[var(--muted)]"><span className="sr-only">Aspect</span></th>
                  {[['Video', Clapperboard], ['Live conversation', Radio], ['Agent', Bot]].map(([l, I]) => {
                    const Icon = I as typeof Bot
                    return <th key={l as string} scope="col" className="px-5 py-4 font-display text-[16px] font-bold"><span className="inline-flex items-center gap-2"><Icon className="size-4 text-[var(--accent)]" aria-hidden />{l as string}</span></th>
                  })}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((r) => (
                  <tr key={r.row} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)]">
                    <th scope="row" className="px-5 py-4 font-semibold">{r.row}</th>
                    <td className="px-5 py-4 text-[var(--muted)]">{r.video}</td>
                    <td className="px-5 py-4 text-[var(--muted)]">{r.live}</td>
                    <td className="px-5 py-4 text-[var(--muted)]">{r.agent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Block>
      </WithToc>
    </StudioLayout>
  )
}

/* ════════════════════════ USE CASES ════════════════════════ */

const CASES: {
  id: string
  icon: typeof Users
  title: string
  photo: PhotoKey
  challenge: string
  how: string
  flow: string[]
  uses: string[]
}[] = [
  {
    id: 'receptionist', icon: Phone, title: 'Receptionist', photo: 'boardroom',
    challenge: 'Calls and visitors arrive at all hours, and the same questions come up again and again.',
    how: 'A receptionist agent greets callers in your face and voice, answers common questions from your documents, and books appointments.',
    flow: ['Greet the caller', 'Find out what they need', 'Answer from your documents', 'Book an appointment', 'Confirm and close'],
    uses: ['Avatar', 'Agent builder', 'Live conversations', 'Knowledge base', 'Tools'],
  },
  {
    id: 'sales', icon: Users, title: 'Sales representative', photo: 'presenting',
    challenge: 'Your team can’t give every prospect a personal walkthrough.',
    how: 'A sales agent walks prospects through your offer in your own face and voice, answers questions, and hands warm leads to your team.',
    flow: ['Introduce the offer', 'Ask what they need', 'Answer questions', 'Collect contact details', 'Hand over to the team'],
    uses: ['Avatar', 'Video', 'Live conversations', 'Knowledge base'],
  },
  {
    id: 'trainer', icon: GraduationCap, title: 'Trainer', photo: 'classroom',
    challenge: 'Delivering the same lesson to every learner takes time, and questions come after class.',
    how: 'Turn lesson scripts into videos of you presenting, then let a trainer agent answer learners’ questions from your course material.',
    flow: ['Present the lesson as video', 'Take questions', 'Answer from course material', 'Point to the next lesson'],
    uses: ['Avatar', 'Video', 'Knowledge base', 'Live conversations'],
  },
  {
    id: 'support', icon: Headset, title: 'Support agent', photo: 'engineer',
    challenge: 'Support queues fill up with questions your documentation already answers.',
    how: 'A support agent answers from your documents, follows your support workflow, and knows when to hand a conversation to a person.',
    flow: ['Understand the issue', 'Search your documents', 'Walk through the fix', 'Escalate if unsure'],
    uses: ['Agent builder', 'Live conversations', 'Knowledge base', 'Guardrails'],
  },
  {
    id: 'onboarding', icon: UserRound, title: 'Onboarding guide', photo: 'learner',
    challenge: 'New customers and team members need the same setup walkthrough every time.',
    how: 'An onboarding guide welcomes people in your face and voice and takes them through setup step by step.',
    flow: ['Welcome them', 'Explain the first steps', 'Answer setup questions', 'Check everything is done'],
    uses: ['Avatar', 'Video', 'Live conversations', 'Knowledge base'],
  },
]

function CaseBlock({ c, i }: { c: (typeof CASES)[number]; i: number }) {
  const [step, setStep] = useState(0)
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="scroll-mt-[140px] lg:scroll-mt-[104px]">
      <div className={cn('grid items-start gap-10 lg:grid-cols-[1fr_1.05fr]', i % 2 === 1 && 'lg:[&>*:first-child]:order-2')}>
        <Reveal>
          <Tilt3D max={5}>
            <div className="s-card group overflow-hidden">
              <div className="aspect-[4/3] overflow-hidden">
                <Photo name={c.photo} sizes="(min-width: 1024px) 40vw, 100vw" className="transition-transform duration-700 group-hover:scale-[1.04]" />
              </div>
              <div className="flex flex-wrap gap-2 p-5">
                {c.uses.map((u) => <Chip key={u}>{u}</Chip>)}
              </div>
            </div>
          </Tilt3D>
        </Reveal>
        <Reveal delay={90}>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-[var(--ink)] text-[var(--on-ink)]"><c.icon className="size-5" aria-hidden /></span>
            <h2 id={`${c.id}-title`} className="font-display text-[30px] font-extrabold tracking-[-0.03em] [font-stretch:112%]">{c.title}</h2>
          </div>
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]">
              <p className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--muted)]">The challenge</p>
              <p className="mt-2 text-[16px] leading-relaxed">{c.challenge}</p>
            </div>
            <div className="rounded-2xl bg-[var(--bg)] p-5 ring-1 ring-[var(--accent)]/40">
              <p className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--accent)]">How the agent helps</p>
              <p className="mt-2 text-[16px] leading-relaxed">{c.how}</p>
            </div>
          </div>
          <p className="mt-7 text-[12.5px] font-bold uppercase tracking-wider text-[var(--muted)]">A typical conversation · click a step</p>
          <ol className="mt-3 flex flex-wrap items-center gap-2">
            {c.flow.map((f, k) => (
              <li key={f} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(k)}
                  aria-pressed={k === step}
                  className={cn('rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold transition-all duration-300', k === step ? 'bg-[var(--ink)] text-[var(--on-ink)] shadow-[0_8px_18px_-10px_rgba(29,58,154,0.9)]' : k < step ? 'bg-[var(--accent)]/10 text-[var(--ink)]' : 'text-[var(--muted)] ring-1 ring-[var(--border)] hover:ring-[var(--ink)]')}
                >
                  {k + 1}. {f}
                </button>
                {k < c.flow.length - 1 && <ArrowRight className="size-3.5 text-[var(--muted)]" aria-hidden />}
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  )
}

export function UseCasesPage() {
  const toc = useMemo(() => CASES.map((c) => ({ id: c.id, label: c.title })), [])
  return (
    <StudioLayout title="Use cases — Rooman Agent">
      <PageIntro crumb="Use cases" title="One avatar. Many jobs." lead="Build a different agent for each job, and give each one your face — or a different avatar. Here’s how teams put Rooman Agent to work, and what each agent does in a conversation.">
        <div className="s-fade mt-8 flex flex-wrap gap-2" style={{ animationDelay: '240ms' }}>
          {CASES.map((c) => <a key={c.id} href={`#${c.id}`}><Chip><c.icon className="size-3.5" aria-hidden />{c.title}</Chip></a>)}
        </div>
      </PageIntro>
      <WithToc items={toc}>
        {CASES.map((c, i) => <CaseBlock key={c.id} c={c} i={i} />)}
      </WithToc>
    </StudioLayout>
  )
}

/* ════════════════════════ FAQ ════════════════════════ */

const FAQS: { cat: string; q: string; a: string }[] = [
  { cat: 'Avatars', q: 'What do I need to create an avatar?', a: 'A short video of yourself, recorded in the browser or uploaded. Face the camera in good light and talk naturally. You confirm consent before anything is trained.' },
  { cat: 'Avatars', q: 'What happens to my video?', a: 'The engine finds your face and body, removes the background and pulls out clean audio. It then packages everything into a reusable digital twin, with your voice cloned alongside it.' },
  { cat: 'Avatars', q: 'Will my avatar always look like me?', a: 'Every generated frame is compared with your original face. Frames where the face has drifted into looking like someone else are flagged or rejected.' },
  { cat: 'Avatars', q: 'Can my avatar use my own voice?', a: 'Yes. Your voice is cloned from the same recording, so your avatar speaks in your voice.' },
  { cat: 'Videos', q: 'How do I make a video?', a: 'Give your avatar a script or upload an audio clip, and it renders a video of you saying it — talking, greeting or demonstrating.' },
  { cat: 'Videos', q: 'Do I need a camera for new videos?', a: 'No. After your avatar is made once, every new video is generated from a script or audio — no camera and no reshoots.' },
  { cat: 'Videos', q: 'How is video usage measured?', a: 'Video generation is tracked as render-minutes in your workspace.' },
  { cat: 'Agents', q: 'How do I build an agent?', a: 'Talk to the builder. It asks about the agent’s purpose, who will call it, what it should collect, its workflow, the tools it needs and its language — then generates a conversation flow and an agent spec.' },
  { cat: 'Agents', q: 'Do I have to answer everything at once?', a: 'No. The builder updates what it knows after each thing you say and asks one specific follow-up for whatever is still missing.' },
  { cat: 'Agents', q: 'Can my agent answer from my documents?', a: 'Yes. Add reference documents while you build the agent. Each agent gets its own knowledge base, searched during conversations.' },
  { cat: 'Agents', q: 'What’s in an agent spec?', a: 'Its purpose, persona, conversation flow, knowledge base, tools, guardrails, avatar and voice, languages, channels and status.' },
  { cat: 'Agents', q: 'Can I review an agent before it goes live?', a: 'Yes. New agents start as drafts. You can review the spec and pick an avatar and voice in your workspace before activating it.' },
  { cat: 'Live', q: 'How does a live conversation work?', a: 'The caller’s speech is transcribed in real time, the agent follows its flow and knowledge base, and replies in your cloned voice with your avatar’s face.' },
  { cat: 'Live', q: 'Where can people reach my agent?', a: 'Agents can be set up for phone, web and API channels.' },
  { cat: 'Live', q: 'Which languages can my agent speak?', a: 'You choose the language when you describe your agent; it’s stored in the agent spec.' },
  { cat: 'Workspace', q: 'Where do I see all my agents?', a: 'Your workspace lists every agent with its status — draft, active or disabled — along with your avatars, videos and assets.' },
  { cat: 'Workspace', q: 'What usage is tracked?', a: 'Render-minutes for video generation and conversation-minutes for live conversations, so you can plan capacity and cost.' },
  { cat: 'Workspace', q: 'Can one avatar be used by many agents?', a: 'Yes. Make your avatar once and give it to as many agents as you need — or use a different avatar for each.' },
]

const CATS = ['All', 'Avatars', 'Videos', 'Agents', 'Live', 'Workspace']
const CAT_ICON: Record<string, typeof Bot> = { All: Sparkles, Avatars: ScanFace, Videos: Captions, Agents: Bot, Live: Radio, Workspace: LayoutDashboard }

export function FaqPage() {
  const [cat, setCat] = useState('All')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(FAQS[0].q)
  const list = FAQS.filter((f) => (cat === 'All' || f.cat === cat) && (q.trim() === '' || (f.q + ' ' + f.a).toLowerCase().includes(q.trim().toLowerCase())))
  return (
    <StudioLayout title="FAQ — Rooman Agent">
      <PageIntro crumb="FAQ" title="Frequently asked questions" lead="Everything about making your avatar, building agents, going live and your workspace. Search or pick a topic.">
        <label className="s-fade relative mt-8 block max-w-xl" style={{ animationDelay: '240ms' }}>
          <span className="sr-only">Search questions</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search questions…"
            className="h-14 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg)] pl-12 pr-4 text-[16px] text-[var(--ink)] shadow-[0_14px_30px_-22px_rgba(29,58,154,0.6)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
          />
        </label>
      </PageIntro>
      <div className="s-wrap grid gap-10 pb-24 pt-10 lg:grid-cols-[220px_1fr] lg:gap-14 lg:pt-16">
        <div role="tablist" aria-label="Topics" className="flex gap-2 overflow-x-auto [scrollbar-width:none] lg:sticky lg:top-[104px] lg:flex-col lg:self-start">
          {CATS.map((c) => {
            const Icon = CAT_ICON[c]
            const n = c === 'All' ? FAQS.length : FAQS.filter((f) => f.cat === c).length
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={cat === c}
                onClick={() => setCat(c)}
                className={cn('flex shrink-0 items-center gap-3 rounded-xl px-4 py-2.5 text-left text-[14.5px] font-semibold transition-all', cat === c ? 'bg-[var(--ink)] text-[var(--on-ink)] shadow-[0_12px_26px_-16px_rgba(29,58,154,0.9)]' : 'text-[var(--muted)] ring-1 ring-[var(--border)] hover:text-[var(--ink)] lg:ring-0 lg:hover:bg-[var(--surface)]')}
              >
                <Icon className="size-4" aria-hidden /> {c}
                <span className={cn('ml-auto rounded-full px-2 text-[12px]', cat === c ? 'bg-white/20' : 'bg-[var(--surface)]')}>{n}</span>
              </button>
            )
          })}
        </div>
        <div>
          <p className="text-[14px] text-[var(--muted)]" aria-live="polite">{list.length} {list.length === 1 ? 'question' : 'questions'}</p>
          <ul className="mt-4 space-y-3">
            {list.map((f) => {
              const on = open === f.q
              return (
                <li key={f.q} className={cn('s-card overflow-hidden transition-shadow', on && '!bg-[var(--bg)] shadow-[0_18px_40px_-28px_rgba(29,58,154,0.8)]')}>
                  <button type="button" onClick={() => setOpen(on ? null : f.q)} aria-expanded={on} className="flex w-full items-center gap-4 px-5 py-4 text-left sm:px-6">
                    <span className="hidden rounded-full bg-[var(--bg)] px-2.5 py-0.5 text-[11.5px] font-semibold text-[var(--accent)] ring-1 ring-[var(--border)] sm:inline">{f.cat}</span>
                    <span className="flex-1 text-[16.5px] font-semibold">{f.q}</span>
                    <span className={cn('grid size-8 shrink-0 place-items-center rounded-full transition-all duration-300', on ? 'rotate-45 bg-[var(--accent)] text-[var(--on-ink)]' : 'ring-1 ring-[var(--border)]')}><Plus className="size-4" aria-hidden /></span>
                  </button>
                  <div className={cn('grid transition-all duration-400', on ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                    <div className="min-h-0 overflow-hidden">
                      <p className="px-5 pb-5 pr-14 text-[15.5px] leading-relaxed text-[var(--muted)] sm:px-6">{f.a}</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          {list.length === 0 && (
            <div className="s-card mt-4 p-8 text-center">
              <ChevronDown className="mx-auto size-6 rotate-180 text-[var(--muted)]" aria-hidden />
              <p className="mt-3 font-semibold">No questions match “{q}”.</p>
              <button type="button" onClick={() => { setQ(''); setCat('All') }} className="mt-3 text-[14px] font-semibold text-[var(--accent)] underline underline-offset-4">Clear search</button>
            </div>
          )}
        </div>
      </div>
    </StudioLayout>
  )
}
