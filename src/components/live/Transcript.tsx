import { useEffect, useRef, type ReactNode } from 'react'
import { AudioLines, BookOpen, GitBranch, MessageSquareText, ShieldCheck, Wrench, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { AvatarChip, type AvatarLike } from '@/components/avatar/AvatarPreview'
import type { LiveEventKind, TranscriptItem } from './types'

export const eventMeta: Record<LiveEventKind, { label: string; icon: LucideIcon; tone: string; explain: string }> = {
  knowledge: { label: 'Knowledge lookup', icon: BookOpen, tone: 'text-[#a3c0ff] bg-info/10 border-info/20', explain: 'Read your documents' },
  tool: { label: 'Tool call', icon: Wrench, tone: 'text-[#c6bcff] bg-accent/10 border-accent/20', explain: 'Used a connected app' },
  workflow: { label: 'Workflow transition', icon: GitBranch, tone: 'text-warning bg-warning/10 border-warning/20', explain: 'Moved to the next step' },
  response: { label: 'Agent response', icon: MessageSquareText, tone: 'text-fg-muted bg-white/[0.05] border-white/10', explain: 'Wrote a reply' },
  guardrail: { label: 'Guardrail', icon: ShieldCheck, tone: 'text-success bg-success/10 border-success/20', explain: 'Followed a safety rule' },
  voice: { label: 'Voice', icon: AudioLines, tone: 'text-[#ff8e9c] bg-live/10 border-live/20', explain: 'Spoke with the avatar voice' },
}

/** Small, friendly chip describing one step the agent took. */
export function EventRow({ kind, label, detail }: { kind: LiveEventKind; label?: string; detail: string }) {
  const m = eventMeta[kind]
  const Icon = m.icon
  return (
    <div className="flex min-w-0 animate-fade-in items-center gap-2 pl-9">
      <span className={cn('inline-flex min-w-0 max-w-full items-start gap-1.5 rounded-[12px] border px-2.5 py-1 text-[12px] leading-tight sm:items-center sm:rounded-full', m.tone)}>
        <Icon className="mt-px size-3.5 shrink-0 sm:mt-0" aria-hidden />
        <span className="shrink-0 font-medium">{label ?? m.label}</span>
        <span aria-hidden className="shrink-0 opacity-50">·</span>
        <span className="min-w-0 break-words text-fg-muted sm:truncate" title={detail}>
          {detail}
        </span>
      </span>
    </div>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/**
 * Live transcript. The avatar's reply streams in word-by-word; completed
 * messages are announced politely (aria-busy defers announcements while a
 * reply is still streaming). Auto-scrolls unless the user scrolled up.
 */
export function Transcript({
  items,
  avatar,
  avatarName,
  userName = 'You',
  showEvents = true,
  empty,
  className,
}: {
  items: TranscriptItem[]
  avatar: AvatarLike
  avatarName: string
  userName?: string
  showEvents?: boolean
  empty?: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const streaming = items.some((i) => i.type === 'message' && i.streaming)

  useEffect(() => {
    const el = ref.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [items])

  const visible = showEvents ? items : items.filter((i) => i.type === 'message')

  return (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
      }}
      className={cn('min-h-0 overflow-y-auto overscroll-contain', className)}
    >
      <ol aria-live="polite" aria-busy={streaming} aria-label="Conversation transcript" className="flex flex-col gap-3 p-4 sm:p-5">
        {visible.length === 0 && empty && <li className="list-none">{empty}</li>}
        {visible.map((it) => {
          if (it.type === 'event') {
            return (
              <li key={it.id} className="list-none">
                <EventRow kind={it.kind} label={it.label} detail={it.detail} />
              </li>
            )
          }
          const mine = it.speaker === 'user'
          return (
            <li key={it.id} className={cn('flex min-w-0 animate-fade-up gap-2.5', mine && 'flex-row-reverse')}>
              {mine ? (
                <span aria-hidden className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[10.5px] font-semibold text-fg-muted ring-1 ring-white/10">
                  {initials(userName === 'You' ? 'Y' : userName)}
                </span>
              ) : (
                <AvatarChip avatar={avatar} size={28} className="mt-0.5" />
              )}
              <div className={cn('flex min-w-0 max-w-[85%] flex-col gap-1', mine && 'items-end')}>
                <span className="text-[11.5px] font-medium text-fg-subtle">{mine ? 'You' : avatarName}</span>
                <p
                  className={cn(
                    'break-words text-[14px] leading-relaxed',
                    mine ? 'rounded-[14px] rounded-tr-[4px] bg-white/[0.07] px-3.5 py-2 text-fg' : 'text-fg',
                  )}
                >
                  {it.text}
                  {it.streaming && <span aria-hidden className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse-soft bg-accent align-[-0.15em]" />}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
