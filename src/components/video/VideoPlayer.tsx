import { useEffect, useRef, useState } from 'react'
import { Maximize2, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDuration } from '@/lib/format'
import type { Video } from '@/types'
import type { AvatarLike } from '@/components/avatar/AvatarPreview'
import { VideoThumb } from './VideoThumb'
import { AvatarPreview } from '@/components/avatar/AvatarPreview'

/**
 * Player with custom controls. Plays `video.url` when the backend supplies one;
 * otherwise renders an animated avatar preview so the flow can be reviewed
 * end-to-end in demo mode.
 */
export function VideoPlayer({ video, avatar, className }: { video: Video; avatar: AvatarLike | undefined; className?: string }) {
  const frame = useRef<HTMLDivElement>(null)
  const media = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [t, setT] = useState(0)
  const duration = video.durationSec || 1

  // Preview clock for demo playback
  useEffect(() => {
    if (!playing || video.url) return
    const id = window.setInterval(() => {
      setT((x) => {
        if (x + 0.25 >= duration) {
          setPlaying(false)
          return 0
        }
        return x + 0.25
      })
    }, 250)
    return () => window.clearInterval(id)
  }, [playing, duration, video.url])

  const toggle = () => {
    if (video.url && media.current) {
      if (media.current.paused) void media.current.play()
      else media.current.pause()
    }
    setPlaying((p) => !p)
  }

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void frame.current?.requestFullscreen?.()
  }

  const seek = (v: number) => {
    setT(v)
    if (media.current) media.current.currentTime = v
  }

  const vertical = video.aspect === '9:16'

  return (
    <div
      ref={frame}
      className={cn('group relative overflow-hidden rounded-panel border border-line bg-black shadow-[0_40px_100px_-30px_rgb(0_0_0/0.9)]', className)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'k') {
          e.preventDefault()
          toggle()
        }
      }}
    >
      <div className={cn('relative mx-auto', vertical ? 'aspect-[9/16] max-h-[70vh]' : video.aspect === '1:1' ? 'aspect-square max-h-[70vh]' : 'aspect-video')}>
        {video.url ? (
          <video
            ref={media}
            src={video.url}
            className="absolute inset-0 size-full object-cover"
            muted={muted}
            playsInline
            onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
            onEnded={() => setPlaying(false)}
          />
        ) : playing ? (
          <div className="absolute inset-0">
            <AvatarPreview avatar={avatar} speaking alive framing={vertical ? 'portrait' : 'stage'} rounded="rounded-none" className="size-full" />
          </div>
        ) : (
          <div className="absolute inset-0">
            <VideoThumb video={video} avatar={avatar} fit="native" showMeta={false} className="size-full !aspect-auto" />
          </div>
        )}

        {!playing && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Play video"
            className="absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition-transform duration-300 hover:scale-105"
          >
            <Play className="ml-0.5 size-6 fill-current" />
          </button>
        )}
      </div>

      {/* controls */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-3 pt-10 opacity-100 transition-opacity duration-300 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <input
          type="range"
          min={0}
          max={duration}
          step={0.25}
          value={t}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
          className="h-4 w-full cursor-pointer"
          style={{ background: `linear-gradient(90deg, #fff ${(t / duration) * 100}%, rgb(255 255 255 / 0.25) ${(t / duration) * 100}%) center / 100% 3px no-repeat` }}
        />
        <div className="mt-1 flex items-center gap-1 text-white">
          <button type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} className="flex size-9 items-center justify-center rounded-full hover:bg-white/10">
            {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
          </button>
          <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute' : 'Mute'} className="flex size-9 items-center justify-center rounded-full hover:bg-white/10">
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <span className="tabular ml-1 text-[12px] text-white/80">
            {formatDuration(t)} / {formatDuration(duration)}
          </span>
          <button type="button" onClick={fullscreen} aria-label="Fullscreen" className="ml-auto flex size-9 items-center justify-center rounded-full hover:bg-white/10">
            <Maximize2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
