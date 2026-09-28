import { memo, useId } from 'react'
import { cn, positioned } from '@/lib/cn'
import type { Avatar } from '@/types'

/** Head-and-shoulders silhouette path (viewBox 0 0 400 500). */
const FIGURE =
  'M200 72C250 72 282 110 282 166C282 206 270 238 250 258C238 270 232 282 232 300L232 316C290 328 350 352 372 400C385 430 390 470 392 500L8 500C10 470 15 430 28 400C50 352 110 328 168 316L168 300C168 282 162 270 150 258C130 238 118 206 118 166C118 110 150 72 200 72Z'

export type AvatarLike = Partial<Pick<Avatar, 'name' | 'thumbnailUrl' | 'previewVideoUrl'>> & { hue: number }

interface AvatarPreviewProps {
  avatar: AvatarLike | undefined
  /** ambient idle motion (breathing + drifting light) */
  alive?: boolean
  speaking?: boolean
  /** show the waveform bars while speaking */
  speakingIndicator?: boolean
  /** scanning overlay while training/processing */
  scanning?: boolean
  className?: string
  /** frame the figure tighter (portrait) or looser (wide stage) */
  framing?: 'portrait' | 'stage' | 'close'
  rounded?: string
  children?: React.ReactNode
}

/**
 * The visual identity of an avatar. Renders real media when the backend
 * supplies it, otherwise an original, hue-tinted cinematic portrait.
 */
export const AvatarPreview = memo(function AvatarPreview({
  avatar,
  alive = true,
  speaking = false,
  speakingIndicator = true,
  scanning = false,
  className,
  framing = 'portrait',
  rounded = 'rounded-panel',
  children,
}: AvatarPreviewProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const hue = avatar?.hue ?? 255
  const h2 = (hue + 40) % 360

  const figureBox =
    framing === 'stage'
      ? 'inset-x-[22%] top-[14%] bottom-0'
      : framing === 'close'
        ? 'inset-x-[4%] top-[6%] -bottom-[6%]'
        : 'inset-x-[10%] top-[12%] bottom-0'

  return (
    <div
      className={cn(positioned(className), 'isolate overflow-hidden bg-[#08080c]', rounded, className)}
      style={{
        backgroundImage: `radial-gradient(120% 80% at 50% 0%, hsl(${hue} 70% 42% / 0.34), transparent 60%), radial-gradient(70% 55% at 85% 90%, hsl(${h2} 80% 50% / 0.18), transparent 70%), linear-gradient(180deg, #0c0c12, #060609)`,
      }}
      role="img"
      aria-label={avatar?.name ? `${avatar.name} avatar preview` : 'Avatar preview'}
    >
      {avatar?.previewVideoUrl ? (
        <video className="absolute inset-0 size-full object-cover" src={avatar.previewVideoUrl} autoPlay muted loop playsInline />
      ) : avatar?.thumbnailUrl ? (
        <img className="absolute inset-0 size-full object-cover" src={avatar.thumbnailUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        <>
          {/* drifting key light */}
          <div
            aria-hidden
            className={cn('absolute -inset-[20%] opacity-70', alive && 'animate-drift')}
            style={{ background: `radial-gradient(35% 30% at 62% 30%, hsl(${hue} 90% 70% / 0.22), transparent 70%)` }}
          />
          {/* studio floor glow */}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: `radial-gradient(60% 80% at 50% 100%, hsl(${hue} 70% 55% / 0.18), transparent 70%)` }} />

          <div className={cn('absolute', figureBox)}>
            <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMax meet" className={cn('size-full', alive && 'animate-breathe origin-bottom')} aria-hidden>
              <defs>
                <linearGradient id={`body-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#1c1c26" />
                  <stop offset="0.55" stopColor="#101017" />
                  <stop offset="1" stopColor="#08080c" />
                </linearGradient>
                <linearGradient id={`rim-${uid}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor={`hsl(${h2} 90% 75%)`} stopOpacity="0.55" />
                  <stop offset="0.35" stopColor={`hsl(${hue} 90% 75%)`} stopOpacity="0" />
                  <stop offset="0.7" stopColor={`hsl(${hue} 90% 78%)`} stopOpacity="0.15" />
                  <stop offset="1" stopColor={`hsl(${hue} 95% 82%)`} stopOpacity="0.95" />
                </linearGradient>
                <radialGradient id={`face-${uid}`} cx="0.58" cy="0.3" r="0.28">
                  <stop offset="0" stopColor={`hsl(${hue} 60% 85%)`} stopOpacity="0.16" />
                  <stop offset="1" stopColor={`hsl(${hue} 60% 85%)`} stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`fade-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0.6" stopColor="white" />
                  <stop offset="1" stopColor="white" stopOpacity="0" />
                </linearGradient>
                <mask id={`mask-${uid}`}>
                  <rect width="400" height="500" fill={`url(#fade-${uid})`} />
                </mask>
                <filter id={`blur-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="10" />
                </filter>
              </defs>
              <g mask={`url(#mask-${uid})`}>
                {/* outer glow */}
                <path d={FIGURE} fill="none" stroke={`url(#rim-${uid})`} strokeWidth="10" filter={`url(#blur-${uid})`} opacity="0.8" />
                <path d={FIGURE} fill={`url(#body-${uid})`} />
                <path d={FIGURE} fill={`url(#face-${uid})`} />
                {/* rim light */}
                <path d={FIGURE} fill="none" stroke={`url(#rim-${uid})`} strokeWidth="2" />
                {/* subtle facial structure */}
                <g opacity="0.22" stroke={`hsl(${hue} 60% 85%)`} strokeWidth="1.2" fill="none" strokeLinecap="round">
                  <path d="M176 168c6-4 14-4 20 0" />
                  <path d="M214 168c6-4 14-4 20 0" />
                  <path d="M205 180c2 12 4 22 0 30c-3 3-8 3-11 1" />
                  <path d={speaking ? 'M186 226c9 7 27 7 36 0' : 'M188 228c8 4 24 4 32 0'} className="transition-all duration-150" />
                </g>
              </g>
            </svg>
          </div>
        </>
      )}

      {/* speaking indicator */}
      {speaking && speakingIndicator && (
        <div aria-hidden className="absolute inset-x-0 bottom-[8%] flex items-end justify-center gap-[3px]">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className="h-4 w-[3px] origin-bottom animate-wave rounded-full bg-white/80"
              style={{ animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
      )}

      {/* scanning overlay (training / processing) */}
      {scanning && (
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 grid-lines opacity-50 [mask-image:linear-gradient(180deg,transparent,black_30%,black_70%,transparent)]" />
          <div className="absolute inset-x-0 h-1/3 animate-scan bg-gradient-to-b from-transparent via-accent/25 to-transparent" />
        </div>
      )}

      {/* vignette */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_55%,rgb(0_0_0/0.6))]" />
      {children}
    </div>
  )
})

/** Small circular avatar for lists, pickers and chips. */
export function AvatarChip({ avatar, size = 32, className }: { avatar: AvatarLike | undefined; size?: number; className?: string }) {
  const hue = avatar?.hue ?? 255
  return (
    <span
      className={cn('relative inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-white/10', className)}
      style={{ width: size, height: size, background: `radial-gradient(90% 90% at 50% 0%, hsl(${hue} 70% 45% / 0.7), #0b0b10 75%)` }}
      aria-hidden
    >
      {avatar?.thumbnailUrl ? (
        <img src={avatar.thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <svg viewBox="0 0 400 500" className="absolute inset-x-[8%] bottom-[-8%] top-[14%]" preserveAspectRatio="xMidYMax meet">
          <path d={FIGURE} fill="#101017" stroke={`hsl(${hue} 90% 78%)`} strokeOpacity="0.7" strokeWidth="8" />
        </svg>
      )}
    </span>
  )
}
