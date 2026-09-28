import type { ReactNode } from 'react'
import { Mic, MicOff, PhoneOff, Settings2, Video, VideoOff, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/cn'

function RoundButton({
  label,
  pressed,
  onClick,
  children,
  tone = 'default',
  disabled,
  showLabel,
}: {
  label: string
  pressed?: boolean
  onClick: () => void
  children: ReactNode
  tone?: 'default' | 'off' | 'danger'
  disabled?: boolean
  showLabel?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          'flex size-12 items-center justify-center rounded-full border backdrop-blur-xl transition-[background-color,border-color,transform] duration-200 ease-out-soft active:scale-95 disabled:opacity-40 sm:size-[52px] [&_svg]:size-5',
          tone === 'danger' && 'border-danger/40 bg-danger text-white hover:bg-[#ff7682]',
          tone === 'off' && 'border-white/20 bg-white/90 text-canvas hover:bg-white',
          tone === 'default' && 'border-white/10 bg-white/[0.08] text-fg hover:bg-white/[0.14]',
        )}
      >
        {children}
      </button>
      {showLabel && <span className="hidden text-[11px] text-fg-subtle sm:block" aria-hidden>{label}</span>}
    </div>
  )
}

/**
 * Call controls. Toggles expose aria-pressed = "is this device ON".
 * A device that's off renders as a light button so the state reads instantly.
 */
export function ControlBar({
  mic,
  camera,
  speaker,
  onMic,
  onCamera,
  onSpeaker,
  onSettings,
  onEnd,
  disabled,
  showLabels,
  className,
}: {
  mic: boolean
  camera: boolean
  speaker: boolean
  onMic: () => void
  onCamera: () => void
  onSpeaker: () => void
  onSettings: () => void
  onEnd: () => void
  disabled?: boolean
  showLabels?: boolean
  className?: string
}) {
  return (
    <div role="toolbar" aria-label="Call controls" className={cn('flex items-start justify-center gap-3 sm:gap-4', className)}>
      <RoundButton label="Microphone" pressed={mic} onClick={onMic} tone={mic ? 'default' : 'off'} disabled={disabled} showLabel={showLabels}>
        {mic ? <Mic aria-hidden /> : <MicOff aria-hidden />}
      </RoundButton>
      <RoundButton label="Camera" pressed={camera} onClick={onCamera} tone={camera ? 'default' : 'off'} disabled={disabled} showLabel={showLabels}>
        {camera ? <Video aria-hidden /> : <VideoOff aria-hidden />}
      </RoundButton>
      <RoundButton label="Speaker" pressed={speaker} onClick={onSpeaker} tone={speaker ? 'default' : 'off'} disabled={disabled} showLabel={showLabels}>
        {speaker ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
      </RoundButton>
      <RoundButton label="Settings" onClick={onSettings} showLabel={showLabels}>
        <Settings2 aria-hidden />
      </RoundButton>
      <RoundButton label="End session" onClick={onEnd} tone="danger" showLabel={showLabels}>
        <PhoneOff aria-hidden />
      </RoundButton>
    </div>
  )
}
