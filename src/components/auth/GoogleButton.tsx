import { useEffect, useRef, useState } from 'react'
import { GOOGLE_CLIENT_ID, isGoogleEnabled } from '@/lib/auth'
import { useTheme } from '@/lib/theme'

/* Minimal typing for the Google Identity Services script. */
interface GoogleAccountsId {
  initialize(config: { client_id: string; callback: (res: { credential: string }) => void; ux_mode?: 'popup' }): void
  renderButton(el: HTMLElement, options: Record<string, unknown>): void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client'
let gsiPromise: Promise<void> | null = null

function loadGsi() {
  if (window.google?.accounts?.id) return Promise.resolve()
  gsiPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      gsiPromise = null
      reject(new Error('Could not load Google sign-in.'))
    }
    document.head.appendChild(script)
  })
  return gsiPromise
}

/**
 * Official "Sign in with Google" button. Renders nothing when
 * VITE_GOOGLE_CLIENT_ID is not configured.
 */
export function GoogleButton({
  mode,
  onCredential,
  onError,
}: {
  mode: 'signin' | 'signup'
  onCredential: (credential: string) => void
  onError: (message: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const theme = useTheme()
  const handlers = useRef({ onCredential, onError })
  handlers.current = { onCredential, onError }

  useEffect(() => {
    if (!isGoogleEnabled) return
    let cancelled = false
    loadGsi()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: 'popup',
          callback: (res) => handlers.current.onCredential(res.credential),
        })
        ref.current.replaceChildren() // re-render cleanly when the theme flips
        window.google.accounts.id.renderButton(ref.current, {
          type: 'standard',
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'pill',
          text: mode === 'signup' ? 'signup_with' : 'continue_with',
          width: Math.min(376, ref.current.offsetWidth || 376),
        })
        setReady(true)
      })
      .catch((e: Error) => handlers.current.onError(e.message))
    return () => {
      cancelled = true
    }
  }, [mode, theme])

  if (!isGoogleEnabled) return null

  return (
    <div className="mb-5">
      <div ref={ref} className="flex min-h-[44px] w-full justify-center" />
      {!ready && <p className="text-center text-[12px] text-fg-subtle">Loading Google sign-in…</p>}
      <div className="mt-5 flex items-center gap-3">
        <div className="h-px flex-1" style={{ background: 'var(--color-line)' }} />
        <span className="text-[12px] text-fg-subtle">or continue with email</span>
        <div className="h-px flex-1" style={{ background: 'var(--color-line)' }} />
      </div>
    </div>
  )
}
