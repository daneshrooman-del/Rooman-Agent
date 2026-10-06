import { useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/cn'
import { AvatarVideo } from '../AvatarVideo'
import { AVATAR_OPTIONS } from '../HeroShowcase'
import { useInView } from '../hooks'

/* Avatars shown on the landing page (Dev is left out). */
const LANDING_AVATARS = AVATAR_OPTIONS.filter((a) => a.id !== 'dev')

/** The platform's real output: a lip-synced avatar clip that plays while on screen. */
export function AvatarStage({
  initial = 0,
  className,
  frameClassName,
  tone = 'dark',
  caption = 'Real output: an AI avatar lip-synced to a new script.',
}: {
  initial?: number
  className?: string
  frameClassName?: string
  tone?: 'dark' | 'light'
  caption?: string
}) {
  const [index, setIndex] = useState(initial)
  const [muted, setMuted] = useState(true)
  const [ref, inView] = useInView<HTMLDivElement>(0.3)
  const avatar = LANDING_AVATARS[Math.min(index, LANDING_AVATARS.length - 1)]
  const light = tone === 'light'

  return (
    <figure className={className}>
      <div ref={ref} className={cn('relative overflow-hidden bg-[var(--l-band)]', frameClassName)}>
        <AvatarVideo
          avatar={avatar}
          src={avatar.video}
          playing={inView}
          muted={muted}
          onAutoplayBlocked={() => setMuted(true)}
          className="[&_img]:object-cover [&_video]:object-cover"
        />
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
          className="absolute right-4 bottom-4 flex size-11 items-center justify-center bg-[var(--l-paper)] text-[var(--l-ink)] transition-colors hover:bg-[var(--l-sand)]"
        >
          {muted ? <VolumeX className="size-4" strokeWidth={1.75} /> : <Volume2 className="size-4" strokeWidth={1.75} />}
        </button>
      </div>
      <figcaption className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
        <span className={cn('text-[14px]', light ? 'text-[var(--l-band-fg)]/65' : 'text-fg-muted')}>{caption}</span>
        <span role="group" aria-label="Choose an avatar" className="flex gap-5">
          {LANDING_AVATARS.map((a, i) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                'l-label py-1 transition-colors',
                i === index
                  ? cn('l-link l-link-static', light ? 'text-[var(--l-band-fg)]' : 'text-fg')
                  : light
                    ? 'text-[var(--l-band-fg)]/50 hover:text-[var(--l-band-fg)]'
                    : 'text-fg-subtle hover:text-fg',
              )}
            >
              {a.name}
            </button>
          ))}
        </span>
      </figcaption>
    </figure>
  )
}
