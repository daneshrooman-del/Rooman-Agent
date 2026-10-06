import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CONTACT, LINKS } from './content'
import { ButtonLink, Reveal } from './primitives'
import { Wordmark } from './EditorialNavbar'

/* Closing call to action. */
export function SectionClosing() {
  return (
    <section aria-labelledby="closing-title" className="l-section border-t border-line">
      <div className="l-wrap">
        <Reveal>
          <h2 id="closing-title" className="l-display max-w-[12ch]">
            Your digital twin is <span className="l-mark">one video</span> away.
          </h2>
        </Reveal>
        <Reveal delay={100} className="mt-14 grid gap-10 border-t border-fg pt-10 lg:mt-20 lg:grid-cols-12 lg:gap-x-8">
          <p className="l-lede lg:col-span-5">
            Create your avatar, build your first agent, and hold your first live conversation.
          </p>
          <div className="flex flex-wrap gap-3 lg:col-span-6 lg:col-start-7 lg:justify-end">
            <ButtonLink to="/signup">Create your avatar</ButtonLink>
            <ButtonLink to="/signin" variant="secondary" arrow={false}>
              Sign in
            </ButtonLink>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

const linkCls = 'l-link text-[15px] text-[var(--l-band-fg)]/75 transition-colors hover:text-[var(--l-band-fg)]'

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="l-label text-[var(--l-band-fg)]/45">{title}</p>
      <ul className="mt-5 space-y-3">{children}</ul>
    </div>
  )
}

const Ext = ({ href, children }: { href: string; children: ReactNode }) => (
  <li>
    <a href={href} target="_blank" rel="noreferrer" className={linkCls}>
      {children}
    </a>
  </li>
)

const Anchor = ({ href, children }: { href: string; children: ReactNode }) => (
  <li>
    <a href={href} className={linkCls}>
      {children}
    </a>
  </li>
)

export function EditorialFooter() {
  return (
    <footer className="border-t border-line bg-[var(--l-band)] text-[var(--l-band-fg)]">
      <div className="l-wrap pt-20 pb-10 lg:pt-28">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-4">
            <p className="max-w-[20em] font-display text-[26px] leading-[1.2] tracking-[-0.015em]">
              Your face, your voice, your agent. Built by Rooman Technologies in Bengaluru.
            </p>
            <address className="mt-8 text-[14px] not-italic leading-[1.7] text-[var(--l-band-fg)]/60">
              {CONTACT.address.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
              <a href={`mailto:${CONTACT.email}`} className="l-link mt-4 inline-block text-[var(--l-band-fg)]">
                {CONTACT.email}
              </a>
              <span className="block">{CONTACT.phone}</span>
            </address>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:col-span-1 lg:col-span-7 lg:col-start-6 lg:grid-cols-3">
            <FooterColumn title="Product">
              <Anchor href="#avatar">Avatar</Anchor>
              <Anchor href="#agent">Agent builder</Anchor>
              <Anchor href="#live">Live conversations</Anchor>
              <Anchor href="#use-cases">Use cases</Anchor>
              <Anchor href="#faq">FAQ</Anchor>
            </FooterColumn>

            <FooterColumn title="Account">
              <li><Link to="/signup" className={linkCls}>Create an account</Link></li>
              <li><Link to="/signin" className={linkCls}>Sign in</Link></li>
              <li><Link to="/workspace" className={linkCls}>Open the workspace</Link></li>
            </FooterColumn>

            <FooterColumn title="Rooman">
              <Ext href={LINKS.about}>About Rooman</Ext>
              <Ext href={LINKS.careers}>Careers</Ext>
              <Ext href={LINKS.privacy}>Privacy policy</Ext>
              <Ext href={LINKS.terms}>Terms</Ext>
            </FooterColumn>
          </div>
        </div>

        <div className="mt-20 border-t border-[var(--l-band-fg)]/15 pt-8 lg:mt-28">
          <Wordmark className="block whitespace-nowrap text-[clamp(4.5rem,19vw,17rem)] leading-[0.8] tracking-[-0.05em] text-[var(--l-band-fg)]" />
          <div className="mt-10 flex flex-col gap-3 text-[13px] text-[var(--l-band-fg)]/45 sm:flex-row sm:justify-between">
            <span>© Rooman Technologies {new Date().getFullYear()}. All rights reserved.</span>
            <span>Photography via Unsplash.</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
