import { useRef, type PointerEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Tilts its content toward the mouse pointer in 3D. Children can sit at different depths with
 * `[transform:translateZ(..)]` (the container preserves 3D), so they parallax against each other.
 * Mouse only; touch and reduced-motion users get the content flat (see .l-tilt in landing.css).
 */
export function Tilt3D({ children, className, max = 6 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || e.pointerType !== 'mouse') return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--tilt-x', `${(-y * max).toFixed(2)}deg`)
    el.style.setProperty('--tilt-y', `${(x * max).toFixed(2)}deg`)
  }
  const onLeave = () => {
    ref.current?.style.setProperty('--tilt-x', '0deg')
    ref.current?.style.setProperty('--tilt-y', '0deg')
  }

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={cn('l-tilt', className)}>
      {children}
    </div>
  )
}
