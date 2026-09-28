import type { ReactNode } from 'react'
import { Loader2, Mic, PhoneOff, WifiOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { AvatarPreview, type AvatarLike } from '@/components/avatar/AvatarPreview'
import type { ConnectionStatus, TurnPhase } from './types'

/**
 * The live avatar "video" area. Shows who is talking (avatar speaking wave,
 * user mic-level ring), what the avatar is doing (thinking) and the
 * connection state as calm overlays. Put extra overlays (top bar, captions,
 * self-view) in `children` — they are positioned by the caller. Borders and
 * size come from `className`.
 */
export function LiveStage({
  avatar,
  status,
  phase,
  micLevel = 0,
  framing = 'stage',
  rounded = 'rounded-hero',
  className,
  showPhasePill = true,
  pillClassName = 'bottom-[5%]',
  ringClassName = 'bottom-[16%]',
  children,
}: {
  avatar: AvatarLike & { name?: string }
  status: ConnectionStatus
  phase: TurnPhase
  micLevel?: number
  framing?: 'stage' | 'close' | 'portrait'
  rounded?: string
  className?: string
  showPhasePill?: boolean
  /** position of the "is speaking / listening" pill */
  pillClassName?: string
  /** position of the user mic-level ring */
  ringClassName?: string
  children?: ReactNode
}) {
  const name = avatar.name ?? 'Avatar'
  const active = status === 'online'
  const speaking = active && phase === 'speaking'
  const listening = active && phase === 'listening'
  const thinking = active && phase === 'thinking'

  return (
    <div className={cn('isolate overflow-hidden bg-[#08080c]', !/(^|\s)(absolute|fixed)(\s|$)/.test(className ?? '') && 'relative', rounded, className)}>
      <AvatarPreview
        avatar={avatar}
        framing={framing}
        rounded={rounded}
        alive={status !== 'ended' && status !== 'offline'}
        speaking={speaking}
        speakingIndicator={!showPhasePill}
        scanning={status === 'connecting'}
        className="h-full w-full"
      >
        {/* speaking halo */}
        <div
          aria-hidden
          className={cn('pointer-events-none absolute inset-0 transition-opacity duration-700', speaking ? 'opacity-100' : 'opacity-0')}
          style={{ background: `radial-gradient(45% 40% at 50% 38%, hsl(${avatar.hue} 90% 70% / 0.16), transparent 70%)` }}
        />
      </AvatarPreview>

      {/* user mic-level ring */}
      {listening && (
        <div aria-hidden className={cn('pointer-events-none absolute inset-x-0 z-[5] flex justify-center', ringClassName)}>
          <div className="relative flex size-16 items-center justify-center">
            <span
              className="absolute inset-0 rounded-full border-2 border-success/60 transition-transform duration-150 ease-out-soft"
              style={{ transform: `scale(${1 + micLevel * 0.55})`, opacity: 0.4 + micLevel * 0.5 }}
            />
            <span className="absolute inset-0 animate-ring rounded-full bg-success/20" />
            <span className="relative flex size-12 items-center justify-center rounded-full bg-success/90 text-canvas shadow-[0_0_40px_rgb(62_213_152/0.45)]">
              <Mic className="size-5" />
            </span>
          </div>
        </div>
      )}

      {/* phase pill */}
      {showPhasePill && active && phase !== 'idle' && (
        <div className={cn('pointer-events-none absolute inset-x-0 z-[5] flex justify-center px-4', pillClassName)}>
          <span className="glass-strong inline-flex h-8 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-medium text-fg">
            {speaking && (
              <>
                <span className="flex h-3 items-end gap-[2px]" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="h-3 w-[2px] origin-bottom animate-wave rounded-full bg-accent" style={{ animationDelay: `${i * 0.12}s` }} />
                  ))}
                </span>
                {name} is speaking
              </>
            )}
            {listening && (
              <>
                <span className="size-2 rounded-full bg-success" aria-hidden />
                Listening to you…
              </>
            )}
            {thinking && (
              <>
                <span className="flex gap-1" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-1.5 animate-pulse-soft rounded-full bg-fg-muted" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </span>
                {name} is thinking
              </>
            )}
          </span>
        </div>
      )}

      {/* connection overlays */}
      {status !== 'online' && status !== 'idle' && (
        <div role="status" className="absolute inset-0 flex items-center justify-center bg-black/35 p-6 backdrop-blur-[2px]">
          <div className="glass-strong flex max-w-xs flex-col items-center gap-2 rounded-card px-5 py-4 text-center">
            {status === 'connecting' && (
              <>
                <Loader2 className="size-5 animate-spin text-accent" aria-hidden />
                <p className="text-sm font-medium">Connecting to {name}…</p>
                <p className="text-[12px] text-fg-subtle">Warming up voice and video</p>
              </>
            )}
            {status === 'reconnecting' && (
              <>
                <Loader2 className="size-5 animate-spin text-warning" aria-hidden />
                <p className="text-sm font-medium">Reconnecting…</p>
                <p className="text-[12px] text-fg-subtle">Your conversation is kept</p>
              </>
            )}
            {status === 'offline' && (
              <>
                <WifiOff className="size-5 text-fg-muted" aria-hidden />
                <p className="text-sm font-medium">You’re offline</p>
                <p className="text-[12px] text-fg-subtle">{name} will pick up where you left off when you reconnect</p>
              </>
            )}
            {status === 'ended' && (
              <>
                <PhoneOff className="size-5 text-fg-muted" aria-hidden />
                <p className="text-sm font-medium">Session ended</p>
              </>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

/** Maps a connection status to the shared StatusIndicator vocabulary. */
export function connectionToStatus(s: ConnectionStatus) {
  return s === 'online' ? 'online' : s === 'connecting' || s === 'reconnecting' ? 'loading' : 'offline'
}

export function connectionLabel(s: ConnectionStatus) {
  return { idle: 'Ready', connecting: 'Connecting', online: 'Online', reconnecting: 'Reconnecting', offline: 'Offline', ended: 'Ended' }[s]
}
