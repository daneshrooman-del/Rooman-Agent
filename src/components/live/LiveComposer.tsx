import { useId, useState } from 'react'
import { ArrowUp, Mic } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Text input + "speak" mic button for talking to an avatar or agent. */
export function LiveComposer({
  onSend,
  onSpeak,
  listening,
  disabled,
  micDisabled,
  placeholder = 'Type a message',
  label = 'Message',
  className,
}: {
  onSend: (text: string) => boolean | void
  onSpeak?: () => void
  listening?: boolean
  disabled?: boolean
  micDisabled?: boolean
  placeholder?: string
  label?: string
  className?: string
}) {
  const [text, setText] = useState('')
  const id = useId()
  return (
    <form
      className={cn('flex min-w-0 items-center gap-2', className)}
      onSubmit={(e) => {
        e.preventDefault()
        if (onSend(text) !== false) setText('')
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative min-w-0 flex-1">
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          className="h-11 w-full rounded-full border border-line-strong bg-white/[0.045] pl-4 pr-12 text-sm text-fg placeholder:text-fg-subtle transition-[border-color,box-shadow] focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:opacity-50"
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={disabled || !text.trim()}
          className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-fg text-canvas transition-opacity disabled:opacity-25"
        >
          <ArrowUp className="size-4" aria-hidden />
        </button>
      </div>
      {onSpeak && (
        <button
          type="button"
          onClick={onSpeak}
          disabled={disabled || micDisabled || listening}
          aria-label={listening ? 'Listening' : 'Speak'}
          title={micDisabled ? 'Microphone is off' : 'Speak (simulated voice)'}
          className={cn(
            'relative flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed',
            listening ? 'border-success/50 bg-success/15 text-success' : 'border-line-strong bg-white/[0.06] text-fg hover:bg-white/[0.1] disabled:opacity-40',
          )}
        >
          {listening && <span aria-hidden className="absolute inset-0 animate-ring rounded-full border border-success/50" />}
          <Mic className="size-[18px]" aria-hidden />
        </button>
      )}
    </form>
  )
}
