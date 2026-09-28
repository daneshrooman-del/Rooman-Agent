import { Copy, Download, Pencil, Play, RotateCcw, Share2 } from 'lucide-react'
import type { Video } from '@/types'
import { timeAgo, formatDuration } from '@/lib/format'
import { useWorkspace } from '@/state/workspace'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { AvatarChip } from '@/components/avatar/AvatarPreview'
import { VideoThumb } from './VideoThumb'

export interface VideoCardActions {
  onPlay: (v: Video) => void
  onEdit: (v: Video) => void
  onDuplicate: (v: Video) => void
  onDownload: (v: Video) => void
  onShare: (v: Video) => void
  /** optional — shows a Retry button on failed videos */
  onRetry?: (v: Video) => void
}

export function VideoCard({ video, actions }: { video: Video; actions: VideoCardActions }) {
  const { avatarById } = useWorkspace()
  const avatar = avatarById(video.avatarId)
  const ready = video.status === 'ready'

  const hoverActions = [
    { label: 'Edit', icon: Pencil, fn: actions.onEdit, needsReady: false },
    { label: 'Duplicate', icon: Copy, fn: actions.onDuplicate, needsReady: false },
    { label: 'Download', icon: Download, fn: actions.onDownload, needsReady: true },
    { label: 'Share', icon: Share2, fn: actions.onShare, needsReady: true },
  ]

  return (
    <article className="group flex flex-col">
      <div className="relative overflow-hidden rounded-card border border-line bg-surface shadow-soft transition-[border-color,box-shadow] duration-300 group-hover:border-line-strong group-hover:shadow-[0_24px_60px_-24px_rgb(0_0_0/0.9),0_0_0_1px_rgb(143_124_255/0.14)]">
        <VideoThumb video={video} avatar={avatar} className="transition-transform duration-700 ease-out-soft group-hover:scale-[1.03]" />
        {ready && (
          <button
            type="button"
            onClick={() => actions.onPlay(video)}
            aria-label={`Play ${video.title}`}
            className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 hover:bg-black/30 focus-visible:bg-black/30 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <span className="flex size-12 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-md">
              <Play className="ml-0.5 size-5 fill-current" aria-hidden />
            </span>
          </button>
        )}
        {video.status === 'failed' && actions.onRetry && (
          <button
            type="button"
            onClick={() => actions.onRetry?.(video)}
            aria-label={`Retry ${video.title}`}
            className="absolute bottom-3 left-1/2 inline-flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3.5 text-[12px] font-medium text-white backdrop-blur-md transition-colors hover:bg-white/20"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Retry
          </button>
        )}
        <div className="absolute right-2.5 top-2.5 flex gap-1 opacity-100 transition-opacity duration-300 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          {hoverActions.map((a) => (
            <button
              key={a.label}
              type="button"
              disabled={a.needsReady && !ready}
              onClick={() => a.fn(video)}
              aria-label={`${a.label} ${video.title}`}
              title={a.label}
              className="flex size-8 items-center justify-center rounded-[9px] bg-black/55 text-white/90 backdrop-blur-md transition-colors hover:bg-black/75 disabled:opacity-30"
            >
              <a.icon className="size-3.5" aria-hidden />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-start gap-3 px-0.5">
        <AvatarChip avatar={avatar} size={28} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-medium">{video.title}</h3>
          <p className="mt-0.5 truncate text-[12px] text-fg-subtle">
            {avatar?.name ?? 'Unknown avatar'} · {ready ? formatDuration(video.durationSec) : '—'} · {timeAgo(video.createdAt)}
          </p>
        </div>
        {!ready && <StatusIndicator status={video.status} />}
      </div>
    </article>
  )
}
