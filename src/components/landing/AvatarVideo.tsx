import { useEffect, useRef, useState, type RefObject } from 'react'
import type { AvatarOption } from './HeroShowcase'

/** Speaker switches dissolve over this long: short enough to never read as a double exposure. */
const SWITCH_MS = 260

/*
 * All clips share one camera (tools/lipsync/framing.py: same eye-line, head size and centre), so a
 * single object-position frames every avatar the same way in any aspect ratio.
 */
const FRAMING = { objectFit: 'cover', objectPosition: '50% 25%' } as const

interface Layer {
  clip: string
  id: number
}

/**
 * Avatar video player. Plays a real talking-head clip (rendered offline by an
 * audio-driven model — see tools/lipsync/avatar_clips.py). Without a clip it shows
 * the still portrait with a slow camera drift; it never fakes mouth movement.
 *
 * Every clip starts and ends on its avatar's rest frame (`avatar.rest`), which is also the poster,
 * so loading, looping and switching never jump. On a switch the incoming clip fades in over the
 * outgoing one only once its first frame is decoded; the outgoing voice fades out underneath.
 */
export function AvatarVideo({
  avatar,
  src,
  playing,
  muted = true,
  loop = true,
  videoRef,
  onEnded,
  onTimeUpdate,
  onAutoplayBlocked,
  onClipChange,
  className = '',
}: {
  avatar: AvatarOption
  src?: string
  playing: boolean
  muted?: boolean
  loop?: boolean
  videoRef?: RefObject<HTMLVideoElement | null>
  onEnded?: () => void
  onTimeUpdate?: (time: number, duration: number) => void
  /** The browser refused to start playback with sound (no user gesture yet). */
  onAutoplayBlocked?: () => void
  /** true once a clip (with audio) is playing, false while the still-portrait fallback shows. */
  onClipChange?: (hasClip: boolean) => void
  className?: string
}) {
  const ownRef = useRef<HTMLVideoElement>(null)
  const ref = videoRef ?? ownRef
  const [failed, setFailed] = useState<string | null>(null)
  const [shown, setShown] = useState<number | null>(null) // layer whose first frame is on screen
  const [posterLoaded, setPosterLoaded] = useState(false)
  const [badPoster, setBadPoster] = useState<string | null>(null) // rest frame not rendered yet
  const poster = avatar.rest && badPoster !== avatar.rest ? avatar.rest : avatar.image
  const clip = src ?? avatar.video
  const useVideo = !!clip && failed !== clip
  const callbacks = useRef({ onAutoplayBlocked, onClipChange })
  callbacks.current = { onAutoplayBlocked, onClipChange }

  // the current clip plus, during a switch, the one it is replacing
  const [layers, setLayers] = useState<Layer[]>([])
  const nextId = useRef(0)
  const elements = useRef(new Map<number, HTMLVideoElement>())

  // a clip that was missing earlier (e.g. still rendering) gets another try when selected again
  useEffect(() => {
    setFailed(null)
    callbacks.current.onClipChange?.(false) // until the new clip has loaded
    if (!clip) {
      setLayers([])
      return
    }
    setLayers((ls) => (ls.at(-1)?.clip === clip ? ls : [...ls.slice(-1), { clip, id: nextId.current++ }]))
  }, [clip])

  useEffect(() => {
    if (!useVideo) callbacks.current.onClipChange?.(false)
  }, [useVideo, clip])

  const current = layers.at(-1)

  // play / pause / mute the current layer
  useEffect(() => {
    const v = ref.current
    if (!v || !useVideo) return
    v.muted = muted
    v.volume = 1
    if (!playing) {
      v.pause()
      return
    }
    v.play().catch((err: DOMException) => {
      if (err.name !== 'NotAllowedError' || v.muted) return
      // autoplay with sound is blocked until the visitor interacts: keep the video moving, muted
      v.muted = true
      callbacks.current.onAutoplayBlocked?.()
      v.play().catch(() => {})
    })
  }, [playing, muted, current?.id, useVideo, ref])

  // once the incoming clip is on screen: fade the outgoing voice out, then drop the old layer
  useEffect(() => {
    if (shown === null || layers.length < 2 || shown !== current?.id) return
    const old = elements.current.get(layers[0].id)
    let raf = 0
    if (old) {
      const t0 = performance.now()
      const v0 = old.volume
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 150)
        old.volume = v0 * (1 - k)
        if (k < 1) raf = requestAnimationFrame(step)
        else old.pause()
      }
      raf = requestAnimationFrame(step)
    }
    const done = setTimeout(() => setLayers((ls) => ls.slice(-1)), SWITCH_MS + 40)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(done)
    }
  }, [shown, layers, current?.id])

  return (
    <div className={`relative h-full w-full overflow-hidden bg-surface-3 ${posterLoaded ? '' : 'animate-pulse'} ${className}`}>
      {useVideo ? (
        <>
          {/* the rest frame underneath, so the panel is never empty while the first clip loads */}
          <img
            src={poster}
            alt=""
            aria-hidden="true"
            onLoad={() => setPosterLoaded(true)}
            onError={() => setBadPoster(avatar.rest ?? null)}
            style={FRAMING}
            className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${posterLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
          {layers.map((layer) => {
            const isCurrent = layer.id === current?.id
            const visible = !isCurrent || shown === layer.id
            return (
              <video
                key={layer.id}
                ref={(el) => {
                  if (el) elements.current.set(layer.id, el)
                  else elements.current.delete(layer.id)
                  if (isCurrent) ref.current = el
                }}
                src={layer.clip}
                poster={poster}
                loop={loop}
                muted={muted}
                playsInline
                preload="auto"
                onEnded={isCurrent ? onEnded : undefined}
                onLoadedData={() => {
                  if (!isCurrent) return
                  setShown(layer.id)
                  callbacks.current.onClipChange?.(true)
                }}
                onTimeUpdate={isCurrent ? (e) => onTimeUpdate?.(e.currentTarget.currentTime, e.currentTarget.duration || 0) : undefined}
                onError={() => {
                  if (!isCurrent) return
                  setFailed(layer.clip)
                  setLayers([])
                }}
                style={{ ...FRAMING, transitionDuration: `${SWITCH_MS}ms` }}
                className={`absolute inset-0 h-full w-full transition-opacity ease-in-out ${visible ? 'opacity-100' : 'opacity-0'}`}
              />
            )
          })}
        </>
      ) : (
        <div className={`avatar-video-drift h-full w-full ${playing ? '' : 'avatar-video-paused'}`}>
          <img
            key={avatar.id}
            src={poster}
            alt={avatar.name}
            onLoad={() => setPosterLoaded(true)}
            onError={() => setBadPoster(avatar.rest ?? null)}
            style={FRAMING}
            className={`h-full w-full transition-opacity duration-300 ${posterLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>
      )}
    </div>
  )
}
