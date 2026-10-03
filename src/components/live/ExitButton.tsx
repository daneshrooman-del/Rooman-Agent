import { ArrowLeft } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'

/** Mobile-only exit control for the immersive Live AI screen (no app chrome on < lg). */
export function ExitButton({ className, onExit }: { className?: string; onExit?: () => void }) {
  const navigate = useNavigate()
  const { key } = useLocation()
  return (
    <button
      type="button"
      aria-label="Exit Live AI"
      onClick={() => {
        onExit?.()
        if (key !== 'default') navigate(-1)
        else navigate('/workspace')
      }}
      className={cn('glass-strong flex size-10 items-center justify-center rounded-full text-fg transition-colors hover:bg-white/10 lg:hidden', className)}
    >
      <ArrowLeft className="size-[18px]" aria-hidden />
    </button>
  )
}
