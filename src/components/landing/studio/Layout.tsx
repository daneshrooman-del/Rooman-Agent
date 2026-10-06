import { useEffect, useLayoutEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { Cta, StudioFooter, StudioNav } from './Sections'
import './studio.css'

/** Shared frame for the public pages: forced light theme, top bar, footer, scroll to top on navigation. */
export function StudioLayout({ title, children, cta = true }: { title: string; children: ReactNode; cta?: boolean }) {
  useDocumentTitle(title)
  const { pathname } = useLocation()

  // Always light here, whatever theme the user picked inside the app; restored on leave.
  useLayoutEffect(() => {
    const html = document.documentElement
    const meta = document.querySelector('meta[name="theme-color"]')
    const prevTheme = html.dataset.theme
    const prevMeta = meta?.getAttribute('content')
    html.dataset.theme = 'light'
    meta?.setAttribute('content', '#FFFFFF')
    return () => {
      if (prevTheme) html.dataset.theme = prevTheme
      if (prevMeta) meta?.setAttribute('content', prevMeta)
    }
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="s-landing min-h-screen overflow-x-clip">
      <StudioNav />
      <main>
        {children}
        {cta && <Cta />}
      </main>
      <StudioFooter />
    </div>
  )
}

/** Title band at the top of each inner page. `aside` adds a visual beside the title on wide screens. */
export function PageIntro({ crumb, title, lead, children, aside }: { crumb: string; title: ReactNode; lead: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className={aside ? 's-wrap grid items-center gap-10 pb-14 pt-10 sm:pb-16 sm:pt-14 lg:grid-cols-[1.15fr_1fr]' : 's-wrap pb-14 pt-10 sm:pb-16 sm:pt-14'}>
        <div>
          <nav aria-label="Breadcrumb" className="s-fade">
            <ol className="flex items-center gap-1.5 text-[13.5px] text-[var(--muted)]">
              <li><Link to="/" className="hover:text-[var(--accent)]">Home</Link></li>
              <li aria-hidden><ChevronRight className="size-3.5" /></li>
              <li aria-current="page" className="font-semibold text-[var(--accent)]">{crumb}</li>
            </ol>
          </nav>
          <h1 className="s-display s-fade mt-6 max-w-[16ch] text-[2.6rem] sm:text-[3.6rem] lg:text-[4.2rem]" style={{ animationDelay: '80ms' }}>
            {title}
          </h1>
          <p className="s-fade mt-6 max-w-2xl text-[18px] leading-relaxed text-[var(--muted)]" style={{ animationDelay: '160ms' }}>{lead}</p>
          {children}
        </div>
        {aside && <div className="s-fade" style={{ animationDelay: '200ms' }}>{aside}</div>}
      </div>
    </section>
  )
}
