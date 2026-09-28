import { Download, Library, Plus, RotateCcw, Share2, X } from 'lucide-react'
import { formatDuration } from '@/lib/format'
import type { Video } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ProgressBar, StageList } from '@/components/ui/States'
import { ConsistencyBadge } from './ConsistencyBadge'
import { GENERATION_STAGES } from './studio'

/** Idle: a one-line recap of what will be rendered. */
export function IdleSummary({ items, estimate }: { items: string[]; estimate: string }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-fg-muted">
        {items.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            {i > 0 && <span className="size-0.5 rounded-full bg-fg-subtle" aria-hidden />}
            {it}
          </span>
        ))}
      </p>
      <p className="tabular shrink-0 text-[12px] text-fg-subtle">{estimate}</p>
    </div>
  )
}

/** Generating: progress, pipeline stages and cancel. */
export function GeneratingPanel({ progress, stage, onCancel }: { progress: number; stage: number; onCancel: () => void }) {
  return (
    <div className="grid animate-fade-up gap-4 px-4 py-4 sm:px-5 xl:grid-cols-[1fr_320px] xl:gap-8">
      <div className="flex min-w-0 flex-col justify-center">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px] font-medium" aria-live="polite">
            {GENERATION_STAGES[stage]}
          </p>
          <span className="tabular text-[13px] text-fg-muted">{progress}%</span>
        </div>
        <ProgressBar value={progress} className="mt-3" label="Video generation progress" />
        <p className="mt-3 text-[12px] text-fg-subtle">
          Step {stage + 1} of {GENERATION_STAGES.length} · You can leave this page — the video keeps rendering in your library.
        </p>
        <div className="mt-4">
          <Button variant="ghost" size="sm" leftIcon={<X />} onClick={onCancel}>
            Cancel generation
          </Button>
        </div>
      </div>
      <div className="hidden xl:block">
        <StageList stages={GENERATION_STAGES} current={stage} />
      </div>
    </div>
  )
}

/** Ready: the finished take with its actions. */
export function ReadyPanel({
  video,
  avatarName,
  onDownload,
  onShare,
  onRegenerate,
  onNew,
}: {
  video: Video
  avatarName?: string
  onDownload: () => void
  onShare: () => void
  onRegenerate: () => void
  onNew: () => void
}) {
  return (
    <div className="flex animate-fade-up flex-col gap-4 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-semibold">{video.title}</h2>
          <p className="mt-0.5 text-[12px] text-fg-subtle">
            {formatDuration(video.durationSec)} · {video.aspect} · {video.language} · saved to your library
          </p>
        </div>
        {video.consistencyVerified && <ConsistencyBadge avatarName={avatarName} align="end" className="self-start sm:self-auto" />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" leftIcon={<Download />} onClick={onDownload}>
          Download
        </Button>
        <Button variant="secondary" size="sm" leftIcon={<Share2 />} onClick={onShare}>
          Share
        </Button>
        <Button variant="secondary" size="sm" leftIcon={<RotateCcw />} onClick={onRegenerate}>
          Regenerate
        </Button>
        <ButtonLink to={`/videos?v=${video.id}`} variant="ghost" size="sm" leftIcon={<Library />}>
          View in library
        </ButtonLink>
        <Button variant="ghost" size="sm" leftIcon={<Plus />} onClick={onNew} className="sm:ml-auto">
          New video
        </Button>
      </div>
    </div>
  )
}
