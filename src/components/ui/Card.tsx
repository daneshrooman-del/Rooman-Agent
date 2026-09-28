import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Interactive cards lift slightly and gain a faint accent edge on hover. */
  interactive?: boolean
  padded?: boolean
  tone?: 'default' | 'glass' | 'flat'
}

export function Card({ interactive, padded = true, tone = 'default', className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'relative rounded-card',
        tone === 'default' && 'surface shadow-soft',
        tone === 'glass' && 'glass',
        tone === 'flat' && 'border border-line bg-white/[0.025]',
        padded && 'p-5',
        interactive &&
          'transition-[transform,border-color,box-shadow,background-color] duration-300 ease-out-soft hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_20px_50px_-20px_rgb(0_0_0/0.8),0_0_0_1px_rgb(143_124_255/0.14)]',
        className,
      )}
      {...rest}
    />
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
