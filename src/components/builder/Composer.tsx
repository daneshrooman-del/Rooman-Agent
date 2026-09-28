import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Conversational composer: Enter sends, Shift+Enter adds a newline. */
export const Composer = forwardRef<HTMLTextAreaElement, {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled?: boolean
  placeholder?: string
  size?: 'hero' | 'compact'
  label?: string
  footer?: React.ReactNode
}>(function Composer({ value, onChange, onSend, disabled, placeholder, size = 'compact', label = 'Describe your agent', footer }, ref) {
  const area = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(ref, () => area.current as HTMLTextAreaElement)
  const hero = size === 'hero'

  // auto-grow
  useEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, hero ? 260 : 160)}px`
  }, [value, hero])

  const canSend = !disabled && value.trim().length > 0

  return (
    <div
      className={cn(
        'group relative rounded-[20px] border border-line-strong bg-surface-2/80 shadow-soft transition-[border-color,box-shadow] duration-300',
        'focus-within:border-accent/45 focus-within:shadow-[0_0_0_4px_rgb(143_124_255/0.1),0_30px_80px_-30px_rgb(143_124_255/0.35)]',
        hero && 'rounded-[24px] bg-surface-2/90',
      )}
    >
      <label className="sr-only" htmlFor="builder-composer">
        {label}
      </label>
      <textarea
        id="builder-composer"
        ref={area}
        rows={hero ? 3 : 1}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            if (canSend) onSend()
          }
        }}
        className={cn(
          'block w-full resize-none bg-transparent text-fg placeholder:text-fg-subtle focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
          hero ? 'min-h-[120px] px-6 pb-16 pt-5 text-[16px] leading-relaxed sm:text-[17px]' : 'min-h-[52px] py-[15px] pl-4 pr-14 text-[14px] leading-[22px]',
        )}
      />
      <div className={cn('absolute flex items-center gap-3', hero ? 'inset-x-4 bottom-3.5 justify-between' : 'bottom-2 right-2')}>
        {hero && <div className="min-w-0 pl-2 text-[12px] text-fg-subtle">{footer}</div>}
        <button
          type="button"
          aria-label="Send"
          onClick={onSend}
          disabled={!canSend}
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full transition-all duration-200 ease-out-soft active:scale-95',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            hero ? 'size-11' : 'size-9',
            canSend ? 'bg-fg text-canvas shadow-[0_8px_24px_-8px_rgb(255_255_255/0.4)] hover:bg-white' : 'bg-white/[0.07] text-fg-subtle',
          )}
        >
          <ArrowUp className={hero ? 'size-5' : 'size-4'} aria-hidden />
        </button>
      </div>
    </div>
  )
})
