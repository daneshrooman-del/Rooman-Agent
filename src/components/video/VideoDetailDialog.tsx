import { Copy, Download, Pencil, Share2 } from 'lucide-react'
import { formatDate, formatDuration } from '@/lib/format'
import type { Video } from '@/types'
import { useWorkspace } from '@/state/workspace'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { VideoPlayer } from './VideoPlayer'
import { ConsistencyBadge } from './ConsistencyBadge'
import { actionLabel, sceneLabel } from './studio'

/** Library player: the video, its identity check and how it was made. */
export function VideoDetailDialog({
  video,
  onClose,
  onEdit,
  onDuplicate,
  onDownload,
  onShare,
}: {
  video: Video | undefined
  onClose: () => void
  onEdit: (v: Video) => void
  onDuplicate: (v: Video) => void
  onDownload: (v: Video) => void
  onShare: (v: Video) => void
}) {
  const { avatarById, voiceName } = useWorkspace()
  const avatar = avatarById(video?.avatarId)
  const ready = video?.status === 'ready'

  const meta = video
    ? [
        ['Avatar', avatar?.name ?? '—'],
        ['Voice', voiceName(video.voiceId)],
        ['Language', video.language],
        ['Action', actionLabel(video.action)],
        ['Scene', sceneLabel(video.scene)],
        ['Format', `${video.aspect}${ready ? ` · ${formatDuration(video.durationSec)}` : ''}`],
      ]
    : []

  return (
    <Dialog
      open={!!video}
      onClose={onClose}
      size="lg"
      title={video?.title ?? ''}
      description={video ? `Created ${formatDate(video.createdAt)} · Powered by ${avatar?.name ?? 'your avatar'}` : undefined}
      footer={
        video && (
          <>
            <Button variant="ghost" size="sm" leftIcon={<Copy />} onClick={() => onDuplicate(video)}>
              Duplicate
            </Button>
            <Button variant="secondary" size="sm" leftIcon={<Pencil />} onClick={() => onEdit(video)}>
              Edit in studio
            </Button>
            <Button variant="secondary" size="sm" leftIcon={<Share2 />} onClick={() => onShare(video)} disabled={!ready}>
              Share
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Download />} onClick={() => onDownload(video)} disabled={!ready}>
              Download
            </Button>
          </>
        )
      }
    >
      {video && (
        <div className="flex flex-col gap-5">
          <div className={video.aspect === '16:9' ? '' : video.aspect === '1:1' ? 'mx-auto w-full max-w-[420px]' : 'mx-auto w-full max-w-[300px]'}>
            <VideoPlayer video={video} avatar={avatar} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ready && video.consistencyVerified ? <ConsistencyBadge avatarName={avatar?.name} /> : <StatusIndicator status={video.status} />}
          </div>
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-fg-subtle">Direction</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-fg-muted">“{video.prompt}”</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {meta.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[12px] text-fg-subtle">{k}</dt>
                <dd className="mt-0.5 truncate text-[13px] font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Dialog>
  )
}
