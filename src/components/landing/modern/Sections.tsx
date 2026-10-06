import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, LayoutDashboard, MessageSquare, Mic, Plus, Radio, ScanFace, Upload, Video } from 'lucide-react'
import { cn } from '@/lib/cn'
import { CONTACT, FAQ, FIGURES, FIGURES_SOURCE, LINKS, USE_CASES } from '../editorial/content'
import { Logo } from './NavHero'
import { Button, Photo, Reveal, SectionHeading } from './ui'

/* ── Built by Rooman: the company behind the product ── */
export function TrustStrip() {
  return (
    <section aria-label="Built by Rooman Technologies" className="pt-20 sm:pt-24">
      <div className="m-wrap">
        <Reveal className="border-y border-line py-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:items-center">
            <p className="text-[16px] leading-relaxed text-fg-muted">
              Built by <span className="font-semibold text-fg">Rooman Technologies</span>, training people in technology
              in Bengaluru since 1999.
            </p>
            <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {FIGURES.map((f) => (
                <div key={f.label}>
                  <dd className="font-display text-[30px] font-bold tracking-[-0.03em] text-fg sm:text-[34px]">
                    {f.value}
                    <span className="text-accent">{f.unit}</span>
                  </dd>
                  <dt className="mt-1 text-[13.5px] leading-snug text-fg-muted">{f.label}</dt>
                </div>
              ))}
            </dl>
          </div>
          <p className="mt-6 text-[12px] text-fg-muted">{FIGURES_SOURCE}</p>
        </Reveal>
      </div>
    </section>
  )
}

/* ── What it does: four plain feature cards ── */
const FEATURES = [
  {
    icon: ScanFace,
    title: 'An avatar from one video',
    body: 'Upload a short video of yourself. Rooman Agent builds a reusable digital twin, with your voice cloned alongside it. Every generated frame is checked against your original face.',
  },
  {
    icon: MessageSquare,
    title: 'Build an agent by talking',
    body: 'Describe what you need, out loud. The builder asks about purpose, callers, workflow, tools and language, then writes the agent for you.',
  },
  {
    icon: Radio,
    title: 'Live conversations',
    body: 'Your agent holds real-time voice and video conversations with your avatar’s face and voice, following the flow you designed.',
  },
  {
    icon: BookOpen,
    title: 'Answers from your documents',
    body: 'Add reference documents while you build the agent, and it answers from them during conversations.',
  },
  {
    icon: LayoutDashboard,
    title: 'One workspace',
    body: 'All your avatars and agents and their status in one list, with render-minutes and conversation-minutes tracked.',
  },
]

export function Bento() {
  return (
    <section id="features" aria-labelledby="features-title" className="m-section">
      <div className="m-wrap">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading id="features-title" eyebrow="Features" title="One recording. An avatar, an agent and a live presence." align="left" />
            <Reveal className="mt-8 hidden overflow-hidden rounded-[18px] border border-line lg:block">
              <Photo name="presenting" sizes="35vw" className="aspect-[4/3]" position="62% 40%" />
            </Reveal>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <li key={f.title} className={i === 0 ? 'sm:col-span-2' : undefined}>
                <Reveal delay={(i % 2) * 70} className="h-full">
                  <article className="m-card m-card-hover h-full p-6 sm:p-7">
                    <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
                      <f.icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="mt-5 font-display text-[19px] font-bold tracking-[-0.015em] text-fg">{f.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">{f.body}</p>
                  </article>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ── How it works ── */
const STEPS = [
  { icon: Upload, title: 'Upload a short video', body: 'Film yourself facing the camera in good light. Rooman Agent builds your avatar from it.' },
  { icon: Mic, title: 'Describe your agent', body: 'Say out loud what the agent should do. Your description becomes its instructions.' },
  { icon: Video, title: 'Go live', body: 'Your agent holds live conversations with your face and your voice.' },
]

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="m-section bg-[#F1ECE3]">
      <div className="m-wrap">
        <SectionHeading id="how-title" eyebrow="How it works" title="From a short video to a live agent" />
        <ol className="mt-14 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Reveal delay={i * 80} className="h-full">
                <div className="m-card h-full p-7">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[44px] font-bold leading-none tracking-[-0.04em] text-accent">{i + 1}</span>
                    <s.icon className="size-6 text-fg-muted" aria-hidden />
                  </div>
                  <h3 className="mt-8 font-display text-[20px] font-bold tracking-[-0.015em] text-fg">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">{s.body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ── Use cases with tabs ── */
export function UseCases() {
  const [active, setActive] = useState(0)
  const c = USE_CASES[active]
  return (
    <section id="use-cases" aria-labelledby="cases-title" className="m-section">
      <div className="m-wrap">
        <SectionHeading id="cases-title" eyebrow="Use cases" title="One avatar. As many agents as you need." />
        <Reveal className="mt-10 flex justify-center">
          <div role="tablist" aria-label="Use cases" className="flex flex-wrap justify-center gap-1 rounded-xl border border-line bg-white p-1">
            {USE_CASES.map((u, i) => (
              <button
                key={u.title}
                type="button"
                role="tab"
                id={`case-tab-${i}`}
                aria-selected={i === active}
                aria-controls="case-panel"
                onClick={() => setActive(i)}
                className={cn(
                  'rounded-lg px-4 py-2 text-[14px] font-semibold transition-colors',
                  i === active ? 'bg-accent text-white' : 'text-fg-muted hover:text-fg',
                )}
              >
                {u.title}
              </button>
            ))}
          </div>
        </Reveal>
        <Reveal className="mt-8">
          <div id="case-panel" role="tabpanel" aria-labelledby={`case-tab-${active}`} className="m-card grid overflow-hidden md:grid-cols-2">
            <div className="aspect-[4/3] md:aspect-auto md:min-h-[340px]">
              <Photo key={c.photo} name={c.photo} sizes="(min-width: 768px) 50vw, 100vw" />
            </div>
            <div className="flex flex-col justify-center p-8 sm:p-12">
              <h3 className="font-display text-[30px] font-bold tracking-[-0.03em] text-fg">{c.title}</h3>
              <p className="mt-4 text-[17px] leading-relaxed text-fg-muted">{c.body}</p>
              <div className="mt-8">
                <Button to="/signup">Build your agent</Button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ── FAQ ── */
export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="m-section border-t border-line">
      <div className="m-wrap grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
        <div>
          <SectionHeading id="faq-title" eyebrow="FAQ" title="Questions, answered" align="left" />
          <p className="mt-4 text-[16px] text-fg-muted">
            Something else?{' '}
            <a className="font-semibold text-accent underline underline-offset-4" href={`mailto:${CONTACT.email}`}>
              Write to us
            </a>
            .
          </p>
        </div>
        <Reveal className="m-faq border-t border-line">
          {FAQ.map((f, i) => (
            <details key={f.q} open={i === 0} className="border-b border-line">
              <summary className="flex items-center justify-between gap-6 py-5 text-[17px] font-semibold text-fg">
                {f.q}
                <span className="m-faq-icon grid size-8 shrink-0 place-items-center rounded-full border border-line text-fg">
                  <Plus className="size-4" aria-hidden />
                </span>
              </summary>
              <p className="pb-6 pr-10 text-[15.5px] leading-relaxed text-fg-muted">{f.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

/* ── Final call to action ── */
export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="pb-24">
      <div className="m-wrap">
        <Reveal>
          <div className="rounded-[24px] bg-accent px-6 py-14 text-center sm:px-12 sm:py-16">
            <h2 id="cta-title" className="mx-auto max-w-2xl font-display text-[34px] font-bold leading-[1.1] tracking-[-0.03em] !text-white sm:text-[46px]">
              Your digital twin is one video away.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[17px] text-white/80">
              Create your avatar, build your first agent, and hold your first live conversation.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/signup" className="m-btn bg-white text-[#1A1A1A] hover:bg-[#F1ECE3]">
                Create your avatar
              </Link>
              <Link to="/signin" className="m-btn !border-white/50 !text-white hover:bg-white/10">
                Sign in
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ── Footer ── */
export function ModernFooter() {
  const ext = { target: '_blank', rel: 'noreferrer' } as const
  return (
    <footer className="border-t border-line">
      <div className="m-wrap grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-fg-muted">
            Built by Rooman Technologies in Bengaluru.
          </p>
          <p className="mt-4 text-[14px] text-fg-muted">
            <a href={`mailto:${CONTACT.email}`} className="font-semibold text-fg hover:text-accent">{CONTACT.email}</a>
            <br />
            {CONTACT.phone}
          </p>
        </div>
        <FooterCol title="Product" items={[['#features', 'Features'], ['#how', 'How it works'], ['#use-cases', 'Use cases'], ['#faq', 'FAQ']]} />
        <div>
          <p className="text-[13px] font-semibold text-fg">Account</p>
          <ul className="mt-4 space-y-2.5 text-[14px] text-fg-muted">
            <li><Link to="/signup" className="hover:text-accent">Create an account</Link></li>
            <li><Link to="/signin" className="hover:text-accent">Sign in</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-fg">Rooman</p>
          <ul className="mt-4 space-y-2.5 text-[14px] text-fg-muted">
            <li><a href={LINKS.about} {...ext} className="hover:text-accent">About Rooman</a></li>
            <li><a href={LINKS.privacy} {...ext} className="hover:text-accent">Privacy policy</a></li>
            <li><a href={LINKS.terms} {...ext} className="hover:text-accent">Terms</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="m-wrap py-6 text-[12.5px] text-fg-muted">© {new Date().getFullYear()} Rooman Technologies. All rights reserved.</div>
      </div>
    </footer>
  )
}

function FooterCol({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-fg">{title}</p>
      <ul className="mt-4 space-y-2.5 text-[14px] text-fg-muted">
        {items.map(([href, label]) => (
          <li key={href}><a href={href} className="hover:text-accent">{label}</a></li>
        ))}
      </ul>
    </div>
  )
}
