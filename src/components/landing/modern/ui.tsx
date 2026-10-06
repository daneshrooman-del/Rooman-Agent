import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { PHOTOS, type PhotoKey } from '../editorial/content'

/** Fades content up the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return setShown(true)
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} style={delay ? { transitionDelay: `${delay}ms` } : undefined} className={cn('m-reveal', shown && 'is-in', className)}>
      {children}
    </div>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[14px] font-semibold text-accent">{children}</p>
}

export function SectionHeading({ eyebrow, title, sub, id, align = 'center' }: {
  eyebrow: string
  title: ReactNode
  sub?: string
  id?: string
  align?: 'center' | 'left'
}) {
  return (
    <Reveal className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-xl'}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="mt-3 font-display text-[32px] font-bold leading-[1.1] tracking-[-0.03em] text-fg sm:text-[42px]">
        {title}
      </h2>
      {sub && <p className="mt-4 text-[17px] leading-relaxed text-fg-muted">{sub}</p>}
    </Reveal>
  )
}

/** Solid or outlined button; routes internally, links out, or jumps to an anchor. */
export function Button({
  to,
  children,
  variant = 'primary',
  size,
  className,
  arrow = variant === 'primary',
}: {
  to: string
  children: ReactNode
  variant?: 'primary' | 'ghost'
  size?: 'sm'
  className?: string
  arrow?: boolean
}) {
  const cls = cn('m-btn', variant === 'primary' ? 'm-btn-primary' : 'm-btn-ghost', size === 'sm' && 'm-btn-sm', className)
  const inner = (
    <>
      {children}
      {arrow && <ArrowRight className="size-4" aria-hidden />}
    </>
  )
  if (to.startsWith('#') || /^(https?:|mailto:)/.test(to)) {
    return (
      <a href={to} className={cls} {...(to.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}>
        {inner}
      </a>
    )
  }
  return (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  )
}

const WIDTHS = [800, 1400, 2200]

export function Photo({ name, sizes, className, position }: { name: PhotoKey; sizes: string; className?: string; position?: string }) {
  const meta = PHOTOS[name]
  return (
    <img
      src={`/images/landing/${name}-1400.webp`}
      srcSet={WIDTHS.map((w) => `/images/landing/${name}-${w}.webp ${w}w`).join(', ')}
      sizes={sizes}
      width={meta.w}
      height={meta.h}
      alt={meta.alt}
      loading="lazy"
      decoding="async"
      style={position ? { objectPosition: position } : undefined}
      className={cn('h-full w-full object-cover', className)}
    />
  )
}
