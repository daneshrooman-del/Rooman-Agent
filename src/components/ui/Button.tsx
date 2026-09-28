import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg'

const base =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium ' +
  'transition-[background-color,border-color,color,box-shadow,transform,opacity,filter] duration-200 ease-out-soft ' +
  'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&_svg]:shrink-0'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-fg text-canvas hover:bg-white shadow-[0_1px_0_0_rgb(255_255_255/0.6)_inset,0_8px_24px_-12px_rgb(255_255_255/0.35)]',
  accent: 'bg-accent-gradient text-white shadow-glow hover:brightness-110',
  secondary: 'bg-white/[0.06] text-fg border border-line-strong hover:bg-white/[0.1] hover:border-white/20',
  ghost: 'text-fg-muted hover:text-fg hover:bg-white/[0.06]',
  destructive: 'bg-danger/12 text-danger border border-danger/25 hover:bg-danger/20',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-[9px] [&_svg]:size-3.5',
  md: 'h-10 px-4 text-sm rounded-control [&_svg]:size-4',
  lg: 'h-12 px-6 text-[15px] rounded-[12px] [&_svg]:size-[18px]',
}

const iconSizes: Record<ButtonSize, string> = {
  sm: 'size-8 rounded-[9px] [&_svg]:size-4',
  md: 'size-10 rounded-control [&_svg]:size-[18px]',
  lg: 'size-12 rounded-[12px] [&_svg]:size-5',
}

export function buttonStyles({
  variant = 'secondary',
  size = 'md',
  iconOnly = false,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; iconOnly?: boolean; className?: string } = {}) {
  return cn(base, variants[variant], iconOnly ? iconSizes[size] : sizes[size], className)
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  /** Square icon-only button — always pass an aria-label. */
  iconOnly?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, leftIcon, rightIcon, iconOnly, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, iconOnly, className })}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  )
})

interface ButtonLinkProps extends Omit<LinkProps, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  iconOnly?: boolean
  className?: string
}

/** A router link that looks like a Button. */
export function ButtonLink({ variant, size, leftIcon, rightIcon, iconOnly, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonStyles({ variant, size, iconOnly, className })} {...rest}>
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  )
}
