import { useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { FAQ, FIGURES, FIGURES_SOURCE, LINKS, USE_CASES, WORKSPACE } from './content'
import { ButtonLink, Photo, Reveal, SectionLabel, TextLink } from './primitives'

/* 04 — Use cases: a structured list; on desktop a sticky photo follows the hovered row. */
export function SectionUseCases() {
  const [active, setActive] = useState(0)

  return (
    <section id="use-cases" aria-labelledby="use-cases-title" className="l-section">
      <div className="l-wrap">
        <SectionLabel number="04" label="Use cases" />

        <div className="mt-12 grid gap-y-6 lg:mt-20 lg:grid-cols-12 lg:gap-x-8">
          <Reveal className="lg:col-span-7">
            <h2 id="use-cases-title" className="l-h2">
              One avatar. As many agents as you need.
            </h2>
          </Reveal>
          <Reveal delay={100} className="lg:col-span-4 lg:col-start-9 lg:self-end">
            <p className="text-[17px] leading-[1.6] text-fg-muted">
              Build a different agent for each job, and give each one the same face — or a different avatar.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid lg:mt-24 lg:grid-cols-12 lg:gap-x-8">
          {/* Sticky photo (desktop only) */}
          <div className="hidden lg:col-span-4 lg:block">
            <div className="sticky top-28">
              <div className="relative aspect-[4/5]">
                {USE_CASES.map((u, i) => (
                  <Photo
                    key={u.title}
                    name={u.photo}
                    sizes="30vw"
                    zoom={false}
                    className={cn('absolute inset-0 transition-opacity duration-700', i === active ? 'opacity-100' : 'opacity-0')}
                  />
                ))}
              </div>
              <p className="l-label mt-4 text-fg-subtle">
                {String(active + 1).padStart(2, '0')} / {String(USE_CASES.length).padStart(2, '0')} — {USE_CASES[active].title}
              </p>
            </div>
          </div>

          <ol className="border-t border-fg lg:col-span-8">
            {USE_CASES.map((u, i) => (
              <li
                key={u.title}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'grid grid-cols-[2.5rem_1fr] items-baseline gap-x-4 border-b border-line py-8 transition-colors duration-300 sm:grid-cols-[3rem_1fr] sm:gap-x-6 lg:-ml-6 lg:px-6 lg:py-10',
                  i === active && 'lg:bg-[var(--l-sand)]/60',
                )}
              >
                <span className="l-label text-fg-subtle">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="font-display text-[38px] leading-none tracking-[-0.025em] sm:text-[52px]">{u.title}</h3>
                  <p className="mt-4 max-w-[32em] text-[16px] leading-[1.6] text-fg-muted">{u.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-12 lg:ml-[calc(33.333%+0.67rem)]">
          <ButtonLink to="/signup">Build your agent</ButtonLink>
        </div>
      </div>
    </section>
  )
}

/* 05 — Workspace: a typographic grid of what's inside the app. */
export function SectionWorkspace() {
  return (
    <section id="workspace" aria-labelledby="workspace-title" className="l-section border-t border-line">
      <div className="l-wrap">
        <SectionLabel number="05" label="The workspace" />

        <div className="mt-12 grid gap-y-8 lg:mt-20 lg:grid-cols-12 lg:gap-x-8">
          <Reveal className="lg:col-span-9">
            <h2 id="workspace-title" className="l-h2">
              Your avatars, agents and usage, in one place.
            </h2>
          </Reveal>
        </div>

        <ol className="mt-16 grid border-t border-fg sm:grid-cols-2 lg:mt-24 lg:grid-cols-4">
          {WORKSPACE.map(([title, body], i) => (
            <Reveal
              as="li"
              key={title}
              delay={i * 80}
              className={cn(
                'l-lift border-b border-line py-10 lg:border-b-0 lg:py-12',
                i % 2 === 1 && 'sm:border-l sm:pl-6',
                i % 2 === 0 && 'sm:pr-6',
                i === 2 && 'lg:border-l lg:pl-6',
              )}
            >
              <span className="l-label text-fg-subtle">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-10 font-display text-[34px] leading-none tracking-[-0.025em] lg:mt-20 xl:text-[40px]">{title}</h3>
              <p className="mt-5 text-[16px] leading-[1.6] text-fg-muted">{body}</p>
            </Reveal>
          ))}
        </ol>

        <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
          <ButtonLink to="/workspace" variant="secondary">
            Open the workspace
          </ButtonLink>
        </div>
      </div>
    </section>
  )
}

/* 06 — Built by Rooman: the company behind the product, with its published figures. */
export function SectionRooman() {
  return (
    <section id="rooman" aria-labelledby="rooman-title" className="l-section bg-[var(--l-sand)]">
      <div className="l-wrap">
        <SectionLabel number="06" label="Built by Rooman" />

        <div className="mt-12 grid gap-y-10 lg:mt-20 lg:grid-cols-12 lg:gap-x-8">
          <Reveal className="lg:col-span-7">
            <h2 id="rooman-title" className="l-statement">
              Built by Rooman Technologies — training people in technology since 1999.
            </h2>
          </Reveal>
          <Reveal delay={100} className="lg:col-span-4 lg:col-start-9 lg:self-end">
            <p className="text-[17px] leading-[1.6] text-fg-muted">
              Rooman trains people in AI, supplies trained talent to businesses, and helps enterprises become
              AI-ready. Rooman Agent is part of that work.
            </p>
            <TextLink href={LINKS.about} className="mt-6 text-[15px]">
              About Rooman
            </TextLink>
          </Reveal>
        </div>

        <dl className="mt-16 grid grid-cols-2 border-t border-fg lg:mt-24 lg:grid-cols-4">
          {FIGURES.map((f, i) => (
            <Reveal
              key={f.label}
              delay={i * 80}
              className={cn(
                'l-lift flex flex-col-reverse justify-end gap-4 border-b border-fg/15 py-8 lg:border-b-0 lg:py-12',
                i % 2 === 1 && 'border-l border-fg/15 pl-4 sm:pl-6',
                i === 2 && 'lg:border-l lg:pl-6',
                i % 2 === 0 && 'pr-4',
              )}
            >
              <dt className="max-w-[14em] text-[14px] leading-snug text-fg-muted">{f.label}</dt>
              <dd className="font-display text-[52px] leading-[0.9] tracking-[-0.04em] sm:text-[72px] lg:text-[64px] xl:text-[84px]">
                {f.value}
                <span className="ml-1 align-top text-[0.42em] tracking-[-0.02em]">{f.unit}</span>
              </dd>
            </Reveal>
          ))}
        </dl>
        <p className="l-label mt-8 text-fg-subtle">{FIGURES_SOURCE}</p>
      </div>
    </section>
  )
}

/* 07 — Questions */
export function SectionFAQ() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="faq" aria-labelledby="faq-title" className="l-section">
      <div className="l-wrap grid gap-y-12 lg:grid-cols-12 lg:gap-x-8">
        <div className="lg:col-span-4">
          <SectionLabel number="07" label="Questions" />
          <h2 id="faq-title" className="l-h2 mt-10">
            Frequently asked.
          </h2>
        </div>

        <ul className="border-t border-fg lg:col-span-7 lg:col-start-6 lg:mt-[3.25rem]">
          {FAQ.map((item, i) => {
            const isOpen = open === i
            return (
              <li key={item.q} className="border-b border-line">
                <h3 className="font-sans text-[18px] font-medium tracking-normal sm:text-[20px]">
                  <button
                    type="button"
                    id={`faq-q-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-start justify-between gap-6 py-6 text-left"
                  >
                    <span>{item.q}</span>
                    <Plus className="l-acc-icon mt-1 size-5 shrink-0" strokeWidth={1.5} aria-hidden />
                  </button>
                </h3>
                <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} data-open={isOpen} aria-hidden={!isOpen} className="l-acc-panel">
                  <div>
                    <p className="max-w-[40em] pb-8 pr-10 text-[16px] leading-[1.65] text-fg-muted">{item.a}</p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
