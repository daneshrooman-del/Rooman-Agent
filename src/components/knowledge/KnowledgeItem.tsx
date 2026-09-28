import { RotateCw, Trash2 } from 'lucide-react'
import type { KnowledgeSource } from '@/types'
import { formatBytes, formatNumber, timeAgo } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/States'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { FileTypeIcon, fileTypeMeta } from './fileTypes'

export const knowledgeGrid = 'sm:grid sm:grid-cols-[minmax(0,1fr)_84px_176px_72px_104px_40px] sm:items-center sm:gap-4'

function StatusCell({ item, onRetry }: { item: KnowledgeSource; onRetry: () => void }) {
  if (item.status === 'processing') {
    return (
      <div className="flex min-w-0 flex-col gap-1.5" aria-live="polite">
        <span className="flex items-center justify-between gap-2">
          <StatusIndicator status="processing" variant="inline" label="Indexing" />
          <span className="tabular text-[12px] text-fg-subtle">{item.progress ?? 0}%</span>
        </span>
        <ProgressBar value={item.progress ?? 0} label={`Indexing ${item.name}`} className="h-1" />
      </div>
    )
  }
  if (item.status === 'failed') {
    return (
      <span className="flex items-center gap-2">
        <StatusIndicator status="failed" variant="inline" />
        <Button size="sm" variant="ghost" leftIcon={<RotateCw />} onClick={onRetry} className="h-7 px-2">
          Retry
        </Button>
      </span>
    )
  }
  return <StatusIndicator status={item.status} variant="inline" />
}

export function KnowledgeItem({ item, onRemove, onRetry }: { item: KnowledgeSource; onRemove: () => void; onRetry: () => void }) {
  const size = item.type === 'url' ? 'Web page' : formatBytes(item.sizeBytes)
  const chunks = item.status === 'ready' ? formatNumber(item.chunks) : '—'
  return (
    <li className={`animate-fade-in rounded-card border border-line bg-white/[0.02] p-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-5 sm:py-3.5 ${knowledgeGrid}`}>
      <div className="flex min-w-0 items-center gap-3">
        <FileTypeIcon type={item.type} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-fg" title={item.name}>
            {item.name}
          </p>
          <p className="text-[12px] text-fg-subtle sm:hidden">
            {fileTypeMeta[item.type].label} · {size} · {chunks === '—' ? 'no chunks yet' : `${chunks} chunks`}
          </p>
        </div>
        <div className="sm:hidden">
          <Button size="md" variant="ghost" iconOnly aria-label={`Remove ${item.name}`} onClick={onRemove}>
            <Trash2 />
          </Button>
        </div>
      </div>

      <span className="tabular hidden text-[13px] text-fg-muted sm:block">{size}</span>
      <div className="mt-3 sm:mt-0">
        <StatusCell item={item} onRetry={onRetry} />
      </div>
      <span className="tabular hidden text-[13px] text-fg-muted sm:block">{chunks}</span>
      <span className="mt-2 block text-[12px] text-fg-subtle sm:mt-0 sm:text-[13px]">
        <span className="sm:hidden">Updated </span>
        <time dateTime={item.updatedAt}>{timeAgo(item.updatedAt)}</time>
      </span>
      <div className="hidden sm:block">
        <Button size="sm" variant="ghost" iconOnly aria-label={`Remove ${item.name}`} onClick={onRemove} className="hover:text-danger">
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}
