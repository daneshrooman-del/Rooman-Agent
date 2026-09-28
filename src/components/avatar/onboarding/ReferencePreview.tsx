import { useId, useState } from 'react'
import { AlertTriangle, Film, RefreshCw, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatBytes, formatDuration } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Button, buttonStyles } from '@/components/ui/Button'
import { AvatarPreview } from '@/components/avatar/AvatarPreview'
import { useObjectUrl } from './useObjectUrl'

export type ReferenceSource = { kind: 'file'; file: File } | { kind: 'sample' }

export const SAMPLE_DURATION_SEC = 192

/** Hidden file input styled as a button — used for "Replace". */
function ReplaceButton({ onFiles }: { onFiles: (f: File[]) => void }) {
  const id = useId()
  return (
    <label htmlFor={id} className={cn(buttonStyles({ variant: 'secondary', size: 'sm' }), 'cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent')}>
      <RefreshCw aria-hidden />
      Replace
      <input
        id={id}
        type="file"
        accept="video/*"
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onFiles(files)
          e.target.value = ''
        }}
      />
    </label>
  )
}

/** Preview of the chosen reference footage — a real <video> for uploaded files, a labelled stand-in for sample footage. */
export function ReferencePreview({ source, onReplace, onRemove }: { source: ReferenceSource; onReplace: (f: File[]) => void; onRemove: () => void }) {
  const url = useObjectUrl(source.kind === 'file' ? source.file : null)
  const [duration, setDuration] = useState<number | null>(null)
  const [unplayable, setUnplayable] = useState(false)

  const isFile = source.kind === 'file'
  const seconds = isFile ? duration : SAMPLE_DURATION_SEC
  const short = seconds !== null && seconds < 60

  return (
    <div className="overflow-hidden rounded-panel border border-line bg-surface shadow-soft animate-fade-up">
      <div className="relative aspect-video bg-black">
        {isFile ? (
          url && !unplayable ? (
            <video
              key={url}
              src={url}
              controls
              playsInline
              muted
              preload="metadata"
              className="size-full object-contain"
              onLoadedMetadata={(e) => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : null)}
              onError={() => setUnplayable(true)}
              aria-label={`Preview of ${source.file.name}`}
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-center text-[13px] text-fg-muted">
              <Film className="size-6 text-fg-subtle" aria-hidden />
              {unplayable ? 'Your browser can’t preview this format, but it can still be uploaded.' : 'Preparing preview…'}
            </div>
          )
        ) : (
          <AvatarPreview avatar={{ hue: 258, name: 'Sample footage' }} framing="stage" rounded="rounded-none" className="size-full">
            <div className="absolute left-3 top-3">
              <Badge tone="warning" className="bg-black/50 backdrop-blur-md">Sample footage · demo</Badge>
            </div>
          </AvatarPreview>
        )}
      </div>

      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] border border-line-strong bg-white/[0.04]">
            <Film className="size-[18px] text-fg-muted" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium">{isFile ? source.file.name : 'Studio reference — sample take.mp4'}</p>
            <p className="tabular text-[12px] text-fg-subtle">
              {isFile ? formatBytes(source.file.size) : 'Provided sample · no upload'}
              {seconds !== null && ` · ${formatDuration(seconds)}`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <ReplaceButton onFiles={onReplace} />
          <Button size="sm" variant="ghost" leftIcon={<Trash2 aria-hidden />} onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>

      {short && (
        <p className="flex items-center gap-2 border-t border-line bg-warning/[0.05] px-5 py-3 text-[12px] text-warning">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          This clip is shorter than recommended. 2–5 minutes gives the most faithful likeness.
        </p>
      )}
    </div>
  )
}
