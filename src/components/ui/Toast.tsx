import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/cn'

type Tone = 'success' | 'info' | 'error'
interface Toast {
  id: number
  title: string
  description?: string
  tone: Tone
}

const ToastContext = createContext<(t: Omit<Toast, 'id' | 'tone'> & { tone?: Tone }) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((t: Omit<Toast, 'id' | 'tone'> & { tone?: Tone }) => {
    const id = Date.now() + Math.random()
    setToasts((l) => [...l.slice(-2), { tone: 'success', ...t, id }])
    window.setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 3600)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:px-6">
        {toasts.map((t) => {
          const Icon = t.tone === 'error' ? AlertTriangle : t.tone === 'info' ? Info : CheckCircle2
          return (
            <div key={t.id} role="status" className="glass-strong pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-[14px] px-4 py-3 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.8)]">
              <Icon className={cn('mt-0.5 size-4 shrink-0', t.tone === 'error' ? 'text-danger' : t.tone === 'info' ? 'text-info' : 'text-success')} aria-hidden />
              <div className="min-w-0">
                <p className="text-[13px] font-medium">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[12px] text-fg-muted">{t.description}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
