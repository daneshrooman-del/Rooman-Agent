import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/cn'

const control =
  'w-full rounded-control border border-line-strong bg-white/[0.035] text-fg placeholder:text-fg-subtle ' +
  'transition-[border-color,background-color,box-shadow] duration-200 ' +
  'hover:border-white/[0.18] focus:border-accent/60 focus:bg-white/[0.05] focus:outline-none focus:ring-4 focus:ring-accent/15 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger/60'

/* ------------------------------------------------------------ Field */
export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
  trailing,
}: {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  htmlFor?: string
  className?: string
  trailing?: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={htmlFor} className="text-[13px] font-medium text-fg">
            {label}
          </label>
          {trailing}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-[12px] text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-[12px] text-fg-subtle">{hint}</p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ Input */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, 'h-10 px-3.5 text-sm', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(control, 'min-h-28 resize-y px-3.5 py-3 text-sm leading-relaxed', className)} {...rest} />
})

export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
      <input type="search" className={cn(control, 'h-10 pl-9 pr-3 text-sm [&::-webkit-search-cancel-button]:hidden')} {...rest} />
    </div>
  )
}

/* ------------------------------------------------------------ Select
   Native <select> for accessibility + mobile pickers, restyled. */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[]
  leading?: ReactNode
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ options, leading, className, ...rest }, ref) {
  return (
    <div className={cn('relative', className)}>
      {leading && <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center">{leading}</span>}
      <select ref={ref} className={cn(control, 'h-10 cursor-pointer pr-9 text-sm', leading ? 'pl-10' : 'pl-3.5')} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
    </div>
  )
})

/* ------------------------------------------------------------ Segmented control */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; icon?: ReactNode }[]
  label: string
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-[12px] border border-line bg-white/[0.03] p-1', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
              e.preventDefault()
              const i = options.findIndex((x) => x.value === value)
              const next = options[(i + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length]
              onChange(next.value)
              ;(e.currentTarget.parentElement?.querySelectorAll('button')[options.indexOf(next)] as HTMLButtonElement | undefined)?.focus()
            }}
            tabIndex={active ? 0 : -1}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] font-medium transition-all duration-200 [&_svg]:size-3.5',
              size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]',
              active ? 'bg-white/[0.1] text-fg shadow-[0_1px_0_0_rgb(255_255_255/0.08)_inset]' : 'text-fg-muted hover:text-fg',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------ Choice chips (multi or single) */
export function ChoiceChips<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: ReactNode; description?: string }[]
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-all duration-200 [&_svg]:size-4',
              active
                ? 'border-accent/50 bg-accent/12 text-fg shadow-[0_0_0_3px_rgb(143_124_255/0.1)]'
                : 'border-line-strong bg-white/[0.02] text-fg-muted hover:border-white/20 hover:text-fg',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------ Slider */
export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  format = (v: number) => String(v),
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  format?: (v: number) => string
}) {
  const id = useId()
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between text-[13px]">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <span className="tabular text-fg-muted">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-4 w-full cursor-pointer"
        style={{
          background: `linear-gradient(90deg, #8f7cff ${pct}%, rgb(255 255 255 / 0.1) ${pct}%) center / 100% 4px no-repeat`,
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------ Toggle */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-40',
          checked ? 'border-accent/60 bg-accent-strong' : 'border-line-strong bg-white/[0.08]',
        )}
      >
        <span
          className={cn(
            'inline-block size-[18px] rounded-full bg-white shadow transition-transform duration-200 ease-out-soft',
            checked ? 'translate-x-[18px]' : 'translate-x-[2px]',
          )}
        />
      </button>
    </div>
  )
}
