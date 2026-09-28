import { memo } from 'react'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { cn, positioned } from '@/lib/cn'
import { formatDuration } from '@/lib/format'
import type { AspectRatio, Scene, Video } from '@/types'
import { AvatarPreview, type AvatarLike } from '@/components/avatar/AvatarPreview'
import { ProgressBar } from '@/components/ui/States'

export const sceneBg: Record<Scene, (hue: number) => string> = {
  studio: (h) =>
    `radial-gradient(60% 70% at 50% 20%, hsl(${h} 40% 30% / 0.55), transparent 70%), linear-gradient(180deg, #111118, #07070a)`,
  office: (h) =>
    `linear-gradient(90deg, transparent 0 12%, rgb(255 255 255 / 0.035) 12% 13%, transparent 13% 38%, rgb(255 255 255 / 0.035) 38% 39%, transparent 39% 62%, rgb(255 255 255 / 0.035) 62% 63%, transparent 63%), radial-gradient(80% 60% at 30% 10%, hsl(${(h + 330) % 360} 50% 55% / 0.28), transparent 70%), linear-gradient(180deg, #121620, #08090d)`,
  custom: (h) =>
    `radial-gradient(70% 60% at 20% 20%, hsl(${(h + 60) % 360} 70% 50% / 0.35), transparent 70%), radial-gradient(60% 60% at 90% 80%, hsl(${h} 80% 55% / 0.3), transparent 70%), #09090d`,
}

export const aspectClass: Record<AspectRatio, string> = {
  '16:9': 'aspect-video',
  '9:16': 'aspect-[9/16]',
  '1:1': 'aspect-square',
}

/** Cinematic thumbnail: scene backdrop + the avatar that stars in it. */
export const VideoThumb = memo(function VideoThumb({
  video,
  avatar,
  className,
  fit = 'cover',
  showMeta = true,
}: {
  video: Pick<Video, 'scene' | 'aspect' | 'durationSec' | 'status' | 'progress'>
  avatar: AvatarLike | undefined
  className?: string
  /** "cover" fills a fixed 16:9 frame, "native" uses the video's own ratio */
  fit?: 'cover' | 'native'
  showMeta?: boolean
}) {
  const hue = avatar?.hue ?? 255
  return (
    <div
      className={cn(positioned(className), 'isolate overflow-hidden', fit === 'native' ? aspectClass[video.aspect] : 'aspect-video', className)}
      style={{ background: sceneBg[video.scene](hue) }}
    >
      <div className="absolute inset-0">
        <AvatarPreview
          avatar={avatar}
          alive={false}
          rounded="rounded-none"
          framing={fit === 'cover' || video.aspect === '16:9' ? 'stage' : 'portrait'}
          className="size-full !bg-transparent ![background-image:none]"
        />
      </div>
      {video.status === 'generating' || video.status === 'queued' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/45 backdrop-blur-[2px]">
          <Sparkles className="size-5 animate-pulse-soft text-accent" aria-hidden />
          <span className="text-[12px] font-medium text-fg">{video.status === 'queued' ? 'Queued' : `Generating · ${video.progress ?? 0}%`}</span>
          <ProgressBar value={video.progress ?? 0} className="w-1/2" label="Generation progress" />
        </div>
      ) : video.status === 'failed' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55">
          <AlertTriangle className="size-5 text-danger" aria-hidden />
          <span className="text-[12px] font-medium text-fg-muted">Generation failed</span>
        </div>
      ) : (
        showMeta && (
          <span className="tabular absolute bottom-2.5 right-2.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            {formatDuration(video.durationSec)}
          </span>
        )
      )}
      {showMeta && (
        <span className="absolute left-2.5 top-2.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/80 backdrop-blur">
          {video.aspect}
        </span>
      )}
    </div>
  )
})
