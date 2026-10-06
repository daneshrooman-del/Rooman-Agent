import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ButtonLink } from './primitives'

const NAV_LINKS = [
  { href: '#avatar', label: 'Avatar' },
  { href: '#agent', label: 'Agent builder' },
  { href: '#live', label: 'Live' },
  { href: '#use-cases', label: 'Use cases' },
  { href: '#faq', label: 'FAQ' },
]

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display text-[26px] font-semibold leading-none tracking-[-0.03em]', className)}>
      Rooman
      <span aria-hidden className="ml-[0.1em] inline-block size-[0.26em] bg-[var(--l-accent)] align-baseline" />
    </span>
  )
}

export function EditorialNavbar() {
  const [open, setOpen] = useState(false)

  // Lock page scroll behind the open mobile sheet; close it on Escape.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-[var(--l-nav)]">
      <div className="l-wrap flex h-16 items-center justify-between gap-6 lg:h-[72px]">
        <Link to="/" aria-label="Rooman Agent — home" className="flex shrink-0 items-baseline gap-2">
          <Wordmark />
          <span className="l-label hidden text-fg-subtle min-[420px]:inline">Agent</span>
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-9">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="l-link text-[14.5px] text-fg-muted transition-colors hover:text-fg">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2 sm:gap-6">
          <Link to="/signin" className="l-link hidden text-[14.5px] text-fg sm:inline">
            Sign in
          </Link>
          <ButtonLink to="/signup" size="sm" arrow={false} className="px-4 sm:px-[18px]">
            Get started
          </ButtonLink>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="landing-menu"
            className="-mr-2 flex h-11 items-center gap-3 px-2 text-[14.5px] lg:hidden"
          >
            <span>{open ? 'Close' : 'Menu'}</span>
            <span aria-hidden className="relative block h-3 w-5">
              <span className={cn('absolute left-0 h-px w-5 bg-fg transition-all duration-300', open ? 'top-1.5 rotate-45' : 'top-0.5')} />
              <span className={cn('absolute left-0 h-px w-5 bg-fg transition-all duration-300', open ? 'top-1.5 -rotate-45' : 'top-2.5')} />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile / tablet sheet */}
      <div
        id="landing-menu"
        hidden={!open}
        className="fixed inset-x-0 top-16 bottom-0 overflow-y-auto border-t border-line bg-[var(--l-nav)] lg:hidden"
      >
        <nav aria-label="Primary" className="l-wrap flex min-h-full flex-col pb-10 pt-4">
          <ul>
            {NAV_LINKS.map((link, i) => (
              <li key={link.href} className="border-b border-line">
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-baseline gap-5 py-5"
                >
                  <span className="l-label w-6 text-fg-subtle">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-display text-[34px] leading-none tracking-[-0.02em]">{link.label}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-auto grid grid-cols-2 gap-3 pt-10">
            <Link to="/signin" onClick={() => setOpen(false)} className="l-btn l-btn-secondary">
              Sign in
            </Link>
            <Link to="/signup" onClick={() => setOpen(false)} className="l-btn l-btn-primary">
              Get started
              <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
          </div>
        </nav>
      </div>
    </header>
  )
}
