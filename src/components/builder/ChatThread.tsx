import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Radio, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import type { BuilderMessage } from './useBuilder'

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Streams text word-by-word once; renders instantly with reduced motion. */
function StreamingText({ text, stream, onDone }: { text: string; stream?: boolean; onDone: () => void }) {
  const words = text.split(/(\s+)/)
  const [count, setCount] = useState(() => (stream && !reducedMotion() ? 0 : words.length))
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    if (count >= words.length) {
      if (stream) doneRef.current()
      return
    }
    const t = window.setTimeout(() => setCount((c) => c + 2), 38)
    return () => window.clearTimeout(t)
  }, [count, words.length, stream])

  const streaming = count < words.length
  return (
    <>
      {words.slice(0, count).join('')}
      {streaming && <span aria-hidden className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse-soft bg-accent" />}
    </>
  )
}

function BuilderAvatar() {
  return (
    <span aria-hidden className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-gradient shadow-[0_0_18px_rgb(143_124_255/0.35)]">
      <Sparkles className="size-3.5 text-white" />
    </span>
  )
}

export function ChatThread({
  messages,
  typing,
  onStreamed,
  onBuildLive,
  onViewAgent,
  canBuildLive,
  scrollRef,
}: {
  messages: BuilderMessage[]
  typing: boolean
  onStreamed: (id: string) => void
  onBuildLive?: () => void
  onViewAgent?: () => void
  canBuildLive?: boolean
  scrollRef?: React.RefObject<HTMLElement | null>
}) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const behavior = reducedMotion() ? 'auto' : 'smooth'
    const box = scrollRef?.current
    if (box && getComputedStyle(box).overflowY !== 'visible') box.scrollTo({ top: box.scrollHeight, behavior })
    else if (messages.length > 1) end.current?.scrollIntoView({ block: 'nearest', behavior })
  }, [messages.length, typing, scrollRef])

  return (
    <div role="log" aria-live="polite" aria-label="Conversation with AI Builder" className="flex flex-col gap-4">
      {messages.map((m) => {
        if (m.role === 'user') {
          return (
            <div key={m.id} className="flex animate-fade-up justify-end">
              <p className="max-w-[88%] whitespace-pre-wrap rounded-[18px] rounded-br-[6px] border border-line-strong bg-white/[0.07] px-4 py-3 text-[14px] leading-relaxed text-fg">
                {m.text}
              </p>
            </div>
          )
        }
        if (m.variant === 'step') {
          return (
            <div key={m.id} className="flex animate-fade-up items-center gap-2.5 pl-10 text-[13px] text-fg-muted">
              <span className="flex size-4 items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="size-2.5" aria-hidden />
              </span>
              {m.text}
            </div>
          )
        }
        return (
          <div key={m.id} className="flex animate-fade-up gap-3">
            <BuilderAvatar />
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[12px] font-medium text-fg-subtle">AI Builder</p>
              <div
                className={cn(
                  'text-[14px] leading-relaxed text-fg',
                  (m.variant === 'ready' || m.variant === 'live') && 'rounded-card border border-accent/20 bg-accent/[0.06] p-4',
                )}
              >
                {m.variant === 'live' && (
                  <span className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-[#c6bcff]">
                    <Radio className="size-3.5" aria-hidden /> From Live AI
                  </span>
                )}
                <p>
                  <StreamingText text={m.text} stream={m.stream} onDone={() => onStreamed(m.id)} />
                </p>
                {m.plan && m.plan.length > 0 && !m.stream && (
                  <ol className="mt-3 flex flex-col gap-2">
                    {m.plan.map((p, i) => (
                      <li key={p} className="flex animate-fade-up gap-2.5 text-[13px] text-fg-muted" style={{ animationDelay: `${i * 90}ms` }}>
                        <span className="tabular mt-px flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong text-[11px] text-fg-subtle">
                          {i + 1}
                        </span>
                        {p}
                      </li>
                    ))}
                  </ol>
                )}
                {m.variant === 'live' && canBuildLive && !m.stream && (
                  <Button className="mt-4" variant="primary" size="sm" rightIcon={<ArrowRight aria-hidden />} onClick={onBuildLive}>
                    Build this agent
                  </Button>
                )}
                {m.variant === 'ready' && onViewAgent && !m.stream && (
                  <Button className="mt-3 lg:hidden" variant="secondary" size="sm" rightIcon={<ArrowRight aria-hidden />} onClick={onViewAgent}>
                    Review agent
                  </Button>
                )}
              </div>
            </div>
          </div>
        )
      })}
      {typing && (
        <div className="flex animate-fade-in gap-3" aria-label="AI Builder is thinking">
          <BuilderAvatar />
          <div className="flex items-center gap-1 rounded-full border border-line bg-white/[0.03] px-3 py-2.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 animate-pulse-soft rounded-full bg-fg-muted" style={{ animationDelay: `${i * 160}ms` }} />
            ))}
          </div>
        </div>
      )}
      <div ref={end} />
    </div>
  )
}
