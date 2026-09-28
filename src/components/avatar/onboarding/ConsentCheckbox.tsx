import { useId, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Large, custom-styled checkbox row backed by a native checkbox (keyboard + screen reader friendly). */
export function ConsentCheckbox({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  title: ReactNode
  description?: ReactNode
}) {
  const id = useId()
  const descId = useId()
  return (
    <label
      htmlFor={id}
      className={cn(
        'group relative flex cursor-pointer gap-4 rounded-card border p-4 transition-[border-color,background-color] duration-200 sm:p-5',
        checked ? 'border-accent/40 bg-accent/[0.06]' : 'border-line bg-white/[0.02] hover:border-line-strong hover:bg-white/[0.035]',
      )}
    >
      <input
        id={id}
        type="checkbox"
        required
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={description ? descId : undefined}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-all duration-200',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          checked ? 'border-transparent bg-accent-gradient text-white shadow-[0_0_0_3px_rgb(143_124_255/0.18)]' : 'border-white/25 bg-white/[0.03] group-hover:border-white/40',
        )}
      >
        <Check className={cn('size-3.5 transition-transform duration-200', checked ? 'scale-100' : 'scale-0')} strokeWidth={3} />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium leading-snug text-fg">{title}</span>
        {description && (
          <span id={descId} className="mt-1 block text-[13px] leading-relaxed text-fg-muted">
            {description}
          </span>
        )}
      </span>
    </label>
  )
}
