import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useOnline } from '@/hooks/useOnline'
import { useWorkspace } from '@/state/workspace'
import { ErrorState, PageLoader } from '@/components/ui/States'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { MobileNav } from './MobileNav'
import { MobileDrawer } from './MobileDrawer'
import { CommandPalette } from './CommandPalette'
import { HelpDialog } from './HelpDialog'

const COLLAPSE_KEY = 'persona.sidebar.collapsed'

/** Routes that take over the full viewport on small screens. */
const immersive = (path: string) => path.startsWith('/live')

export function AppShell() {
  const { pathname } = useLocation()
  const online = useOnline()
  const { status, error, reload } = useWorkspace()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [palette, setPalette] = useState(false)
  const [help, setHelp] = useState(false)
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* storage unavailable — preference just won't persist */
    }
  }, [collapsed])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target.closest('input, textarea, select, [contenteditable=true]')
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      } else if (e.key === '[' && !typing && !e.metaKey && !e.ctrlKey) {
        setCollapsed((c) => !c)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  const full = immersive(pathname)

  return (
    <div className="relative flex min-h-dvh">
      <a href="#main" className="sr-only z-[100] rounded-[10px] bg-fg px-4 py-2 text-canvas focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <div className="app-atmosphere" aria-hidden />
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} onHelp={() => setHelp(true)} />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <div className={cn(full && 'hidden lg:block')}>
          <Topbar onSearch={() => setPalette(true)} onOpenDrawer={() => setDrawer(true)} />
        </div>
        {!online && (
          <div role="status" className="flex items-center justify-center gap-2 border-b border-warning/20 bg-warning/10 px-4 py-2 text-[13px] text-warning">
            <WifiOff className="size-4" aria-hidden />
            You’re offline. Generation, live sessions and agent sync will resume when you reconnect.
          </div>
        )}
        <main
          id="main"
          tabIndex={-1}
          className={cn(
            'mx-auto w-full flex-1 focus:outline-none',
            full ? 'max-w-none lg:max-w-[1600px] lg:px-8 lg:py-6' : 'max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pb-16 lg:pt-10',
          )}
        >
          {status === 'loading' ? (
            <PageLoader />
          ) : status === 'error' ? (
            <ErrorState title="We couldn’t load your workspace" description={error ?? undefined} onRetry={reload} />
          ) : (
            <Suspense fallback={<PageLoader />}>
              <div key={pathname} className="animate-fade-up">
                <Outlet />
              </div>
            </Suspense>
          )}
        </main>
      </div>

      {!full && <MobileNav />}
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <HelpDialog open={help} onClose={() => setHelp(false)} />
    </div>
  )
}
