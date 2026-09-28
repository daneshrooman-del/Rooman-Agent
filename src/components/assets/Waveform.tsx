import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { seeded } from './assetMeta'

/** Simulated playback clock for audio previews (no real media in demo mode). */
export function usePlayback(durationSec = 0) {
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!playing) return
    const total = Math.max(durationSec, 1)
    timer.current = window.setInterval(() => {
      setElapsed((e) => {
        const next = e + 0.2
        if (next >= total) {
          setPlaying(false)
          return 0
        }
        return next
      })
    }, 200)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [playing, durationSec])

  return { playing, elapsed, toggle: () => setPlaying((p) => !p) }
}

/** Elegant static waveform; bars breathe while playing and fill up to the playhead. */
export function Waveform({
  seed,
  bars = 56,
  playing = false,
  progress = 0,
  className,
}: {
  seed: string
  bars?: number
  playing?: boolean
  /** 0–1 */
  progress?: number
  className?: string
}) {
  const heights = useMemo(() => {
    const rnd = seeded(seed)
    return Array.from({ length: bars }, (_, i) => {
      const t = i / (bars - 1)
      const envelope = 0.35 + 0.65 * Math.sin(Math.PI * t) ** 0.6
      return Math.max(0.12, Math.min(1, envelope * (0.35 + rnd() * 0.75)))
    })
  }, [seed, bars])

  return (
    <div aria-hidden className={cn('flex h-full w-full items-center gap-[2px]', className)}>
      {heights.map((h, i) => {
        const played = i / bars < progress
        return (
          <span
            key={i}
            className={cn(
              'block min-w-[2px] flex-1 origin-center rounded-full transition-colors duration-300',
              played ? 'bg-gradient-to-b from-accent to-accent-2' : 'bg-white/[0.22]',
              playing && 'animate-wave',
            )}
            style={{ height: `${h * 100}%`, animationDelay: playing ? `${(i % 9) * 90}ms` : undefined }}
          />
        )
      })}
    </div>
  )
}
