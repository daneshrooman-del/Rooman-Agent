import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { PHOTOS, type PhotoKey } from './content'

/** Fades content up once, the first time it scrolls into view. */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  delay?: number
  as?: 'div' | 'li' | 'figure'
}) {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return setShown(true)
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const style: CSSProperties | undefined = delay ? { transitionDelay: `${delay}ms` } : undefined
  return (
    <Tag ref={ref as never} style={style} className={cn('l-reveal', shown && 'is-in', className)}>
      {children}
    </Tag>
  )
}

/** "01 — About" label with a hairline rule that runs to the edge of the column. */
export function SectionLabel({ number, label, tone = 'dark' }: { number: string; label: string; tone?: 'dark' | 'light' }) {
  return (
    <div className={cn('flex items-center gap-4', tone === 'light' ? 'text-[var(--l-band-fg)]/70' : 'text-fg-subtle')}>
      <span className="l-label">
        <span className={tone === 'light' ? 'text-[var(--l-band-fg)]' : 'text-fg'}>{number}</span>
        <span className="mx-2">—</span>
        {label}
      </span>
      <span className={cn('h-px flex-1', tone === 'light' ? 'bg-[var(--l-band-fg)]/20' : 'bg-line')} />
    </div>
  )
}

const WIDTHS = [800, 1400, 2200]

/** A self-hosted photograph with responsive sources and a cropped frame. */
export function Photo({
  name,
  sizes,
  className,
  imgClassName,
  position,
  priority,
  zoom = true,
}: {
  name: PhotoKey
  sizes: string
  className?: string
  imgClassName?: string
  /** CSS object-position, for art-directed crops. */
  position?: string
  priority?: boolean
  zoom?: boolean
}) {
  const meta = PHOTOS[name]
  return (
    <div className={cn('l-photo', zoom && 'l-photo-zoom', className)}>
      <img
        src={`/images/landing/${name}-1400.webp`}
        srcSet={WIDTHS.map((w) => `/images/landing/${name}-${w}.webp ${w}w`).join(', ')}
        sizes={sizes}
        width={meta.w}
        height={meta.h}
        alt={meta.alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        style={position ? { objectPosition: position } : undefined}
        className={imgClassName}
      />
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'accent'

const isExternal = (to: string) => /^(https?:|mailto:|tel:)/.test(to)

/** Rectangular button that routes internally, links out, or jumps to an anchor. */
export function ButtonLink({
  to,
  children,
  variant = 'primary',
  size,
  className,
  arrow = true,
}: {
  to: string
  children: ReactNode
  variant?: Variant
  size?: 'sm'
  className?: string
  arrow?: boolean
}) {
  const cls = cn('l-btn', `l-btn-${variant}`, size === 'sm' && 'l-btn-sm', className)
  const content = (
    <>
      <span>{children}</span>
      {arrow && <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />}
    </>
  )
  if (to.startsWith('#') || isExternal(to)) {
    return (
      <a href={to} className={cls} {...(to.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}>
        {content}
      </a>
    )
  }
  return (
    <Link to={to} className={cls}>
      {content}
    </Link>
  )
}

/** Inline text link with an animated underline; external links open in a new tab. */
export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const external = href.startsWith('http')
  return (
    <a
      href={href}
      className={cn('group inline-flex items-center gap-1.5 font-medium', className)}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      <span className="l-link">{children}</span>
      {external ? (
        <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.75} aria-hidden />
      ) : (
        <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={1.75} aria-hidden />
      )}
    </a>
  )
}
