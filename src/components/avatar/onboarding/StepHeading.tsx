import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * The page's h1 for each onboarding step. When a step is entered via
 * navigation (not initial load), focus moves here so screen reader and
 * keyboard users land at the top of the new step.
 */
export function StepHeading({
  eyebrow,
  title,
  description,
  focusOnMount,
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  focusOnMount?: boolean
  className?: string
}) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (focusOnMount) ref.current?.focus({ preventScroll: false })
  }, [focusOnMount])
  return (
    <div className={cn('animate-fade-up', className)}>
      {eyebrow && <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-fg-subtle">{eyebrow}</p>}
      <h1 ref={ref} tabIndex={-1} className="text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] outline-none sm:text-[44px]">
        {title}
      </h1>
      {description && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-muted">{description}</p>}
    </div>
  )
}
