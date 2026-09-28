import { useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, WifiOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'

interface GenerateBarProps {
  label: string
  hint: ReactNode
  hintTone?: 'muted' | 'warning'
  offline?: boolean
  disabled?: boolean
  loading?: boolean
  onGenerate: () => void
  meta?: ReactNode
}

function Bar({ label, hint, hintTone = 'muted', offline, disabled, loading, onGenerate, meta }: GenerateBarProps) {
  const hintId = useId()
  return (
    <>
      {meta}
      <Button
        variant="accent"
        size="lg"
        className="w-full"
        leftIcon={offline ? <WifiOff /> : <Sparkles />}
        disabled={disabled}
        loading={loading}
        onClick={onGenerate}
        aria-describedby={hintId}
      >
        {label}
      </Button>
      <p id={hintId} className={cn('mt-2 text-center text-[12px]', hintTone === 'warning' ? 'text-warning' : 'text-fg-subtle')} aria-live="polite">
        {hint}
      </p>
    </>
  )
}

/**
 * The studio's primary action. Inline panel footer on desktop; on mobile a
 * bar pinned above the tab bar (portaled to <body> so page transitions that
 * leave a transform on ancestors can't break `position: fixed`).
 */
export function GenerateBar(props: GenerateBarProps) {
  return (
    <>
      <div className="hidden border-t border-line px-6 pb-5 pt-4 lg:block">
        <Bar {...props} />
      </div>
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-canvas/85 px-4 pb-3 pt-3 backdrop-blur-xl lg:hidden">
            <div className="mx-auto max-w-lg">
              <Bar {...props} meta={undefined} />
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
