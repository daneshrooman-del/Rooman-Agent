import { AVATAR_PIPELINE, BUILDER_EXAMPLE, BUILDER_SLOTS } from './content'
import { ButtonLink, Photo, Reveal, SectionLabel } from './primitives'
import { AvatarStage } from './AvatarStage'
import { Tilt3D } from './Tilt3D'

/* 01 — Avatar: the engine that turns a video into a digital twin. */
export function SectionAvatar() {
  return (
    <section id="avatar" aria-labelledby="avatar-title" className="l-section">
      <div className="l-wrap">
        <SectionLabel number="01" label="Create your avatar" />

        <div className="mt-12 grid grid-cols-4 gap-x-4 sm:grid-cols-6 sm:gap-x-6 lg:mt-20 lg:grid-cols-12 lg:gap-x-8">
          <Reveal className="col-span-4 sm:col-span-6 lg:col-span-10 lg:col-start-2">
            <h2 id="avatar-title" className="l-statement">
              Record yourself once. Your digital twin does the rest —{' '}
              <span className="text-fg-subtle">and it never turns into someone else.</span>
            </h2>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-y-14 lg:mt-24 lg:grid-cols-12 lg:gap-x-8">
          {/* Overlapping composition: the real person, then the pipeline */}
          <Reveal className="relative lg:col-span-6">
            <Tilt3D max={6}>
              <Photo name="presenting" sizes="(min-width: 1024px) 48vw, 100vw" className="aspect-[4/3] rounded-[20px] shadow-[0_30px_70px_-24px_rgba(139,92,246,0.45)]" position="62% 40%" />
            </Tilt3D>
            <p className="l-label mt-4 text-fg-subtle">Your twin presents for you — in meetings, lessons and calls</p>
          </Reveal>

          <div className="lg:col-span-5 lg:col-start-8">
            <ol className="border-t border-fg">
              {AVATAR_PIPELINE.map((step, i) => (
                <Reveal as="li" key={step.title} delay={i * 80} className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-b border-line py-7">
                  <span className="l-label pt-2 text-fg-subtle">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="font-display text-[30px] leading-none tracking-[-0.02em]">{step.title}</h3>
                    <p className="mt-3 text-[16px] leading-[1.6] text-fg-muted">{step.body}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
            <div className="mt-10">
              <ButtonLink to="/signup">Create your avatar</ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* 02 — Agent builder: a conversation that produces an agent spec. */
export function SectionAgentBuilder() {
  return (
    <section id="agent" aria-labelledby="agent-title" className="l-section border-t border-line">
      <div className="l-wrap">
        <SectionLabel number="02" label="Build an agent" />

        <div className="mt-12 grid gap-y-8 lg:mt-20 lg:grid-cols-12 lg:gap-x-8">
          <Reveal className="lg:col-span-8">
            <h2 id="agent-title" className="l-h2">
              Describe the agent you need. <span className="text-fg-subtle">Out loud.</span>
            </h2>
          </Reveal>
          <Reveal delay={100} className="lg:col-span-4 lg:self-end">
            <p className="text-[17px] leading-[1.6] text-fg-muted">
              Talk to the builder like you would brief a new hire. It listens, asks what’s missing, and turns the
              conversation into a ready-to-deploy agent.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-y-16 lg:mt-24 lg:grid-cols-12 lg:gap-x-8">
          {/* What it listens for */}
          <Reveal className="lg:col-span-5">
            <p className="l-label text-fg-subtle">What the builder listens for</p>
            <dl className="mt-6 border-t border-fg">
              {BUILDER_SLOTS.map(([term, desc]) => (
                <div key={term} className="flex items-baseline justify-between gap-6 border-b border-line py-5">
                  <dt className="font-display text-[26px] leading-none tracking-[-0.015em]">{term}</dt>
                  <dd className="text-right text-[15px] text-fg-muted">{desc}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-[15px] leading-[1.6] text-fg-muted">
              Add your reference documents and the agent answers from them.
            </p>
          </Reveal>

          {/* Example exchange → spec */}
          <Reveal delay={120} className="lg:col-span-6 lg:col-start-7">
            <p className="l-label text-fg-subtle">Example conversation</p>
            <div className="mt-6 space-y-7 border-l-[3px] border-accent pl-6 sm:pl-8">
              {BUILDER_EXAMPLE.map((line, i) => (
                <div key={i}>
                  <p className="l-label text-fg-subtle">{line.who}</p>
                  <p
                    className={
                      line.who === 'You'
                        ? 'mt-2 font-display text-[22px] leading-[1.35] tracking-[-0.01em] sm:text-[26px]'
                        : 'mt-2 text-[17px] leading-[1.6] text-fg-muted'
                    }
                  >
                    {line.text}
                  </p>
                </div>
              ))}
            </div>

            <Tilt3D max={5} className="mt-12">
            <div className="rounded-[20px] border border-line-strong bg-[var(--l-card)] p-6 text-[var(--l-band-fg)] backdrop-blur-xl shadow-[0_30px_70px_-24px_rgba(139,92,246,0.45)] sm:p-8">
              <div className="flex items-baseline justify-between gap-4">
                <p className="l-label text-[var(--l-band-fg)]"><span className="mr-2 inline-block size-[7px] bg-[var(--l-accent)] align-middle" />Result · agent spec</p>
                <p className="l-label text-fg-subtle">Illustrative</p>
              </div>
              <dl className="mt-6 grid gap-x-8 gap-y-4 text-[15px] sm:grid-cols-[8rem_1fr]">
                {[
                  ['Purpose', 'Receptionist for a training centre'],
                  ['Callers', 'Students'],
                  ['Workflow', 'Answer course questions → book a counselling slot'],
                  ['Tools', 'Calendar booking'],
                  ['Language', 'English'],
                ].map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-[var(--l-band-fg)]/50">{k}</dt>
                    <dd className="-mt-3 sm:mt-0">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            </Tilt3D>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* 03 — Live (full-width warm band) */
export function SectionLive() {
  return (
    <section id="live" aria-labelledby="live-title" className="l-section border-t border-line bg-[var(--l-band)] text-[var(--l-band-fg)]">
      <div className="l-wrap">
        <SectionLabel number="03" label="Go live" tone="light" />

        <div className="mt-12 grid gap-y-16 lg:mt-20 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-6">
            <Reveal>
              <h2 id="live-title" className="l-h2">
                Then it picks up the call — <span className="l-mark">as you.</span>
              </h2>
              <p className="mt-8 max-w-[32em] text-[18px] leading-[1.6] text-[var(--l-band-fg)]/70">
                Your agent holds real-time voice and video conversations, using your avatar’s face and voice. It
                follows the flow you designed and answers from your documents.
              </p>
            </Reveal>

            <ol className="mt-14 border-t border-[var(--l-band-fg)]/20">
              {[
                ['Listens', 'Speech is transcribed as the caller talks.'],
                ['Thinks', 'It follows your conversation flow and knowledge base.'],
                ['Speaks', 'Replies come back in your avatar’s face and voice.'],
              ].map(([title, body], i) => (
                <Reveal as="li" key={title} delay={i * 80} className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-b border-[var(--l-band-fg)]/20 py-6">
                  <span className="l-label pt-1.5 text-[var(--l-band-fg)]/50">{String(i + 1).padStart(2, '0')}</span>
                  <p className="text-[16px] leading-[1.55]">
                    <span className="font-display text-[24px] tracking-[-0.01em]">{title}.</span>{' '}
                    <span className="text-[var(--l-band-fg)]/65">{body}</span>
                  </p>
                </Reveal>
              ))}
            </ol>

            <div className="mt-10">
              <ButtonLink to="/signup" variant="accent">
                Try a live conversation
              </ButtonLink>
            </div>
          </div>

          <Reveal delay={120} className="lg:col-span-5 lg:col-start-8">
            <Tilt3D max={7}>
              <AvatarStage initial={1} tone="light" frameClassName="aspect-[4/5] rounded-[28px] shadow-[0_0_100px_-10px_rgba(236,72,153,0.45)]" caption="Live conversations use the same avatar." />
            </Tilt3D>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
