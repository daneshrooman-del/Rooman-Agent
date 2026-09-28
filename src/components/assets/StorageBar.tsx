import { formatBytes } from '@/lib/format'
import type { AssetKind } from '@/types'
import { kindLabel, type LibraryAsset } from './assetMeta'

const kindColor: Record<AssetKind, string> = {
  avatar: '#8f7cff',
  video: '#5b8dff',
  audio: '#3ed598',
  document: '#a3a3b2',
  image: '#74748a',
}
const order: AssetKind[] = ['avatar', 'video', 'audio', 'document', 'image']

/** Workspace storage usage, split by the asset kinds visible in the library. */
export function StorageBar({ assets, usedBytes, totalBytes }: { assets: LibraryAsset[]; usedBytes: number; totalBytes: number }) {
  const byKind = order.map((k) => ({ kind: k, bytes: assets.filter((a) => a.kind === k).reduce((s, a) => s + a.sizeBytes, 0) }))
  const libraryBytes = byKind.reduce((s, x) => s + x.bytes, 0)
  const used = Math.max(usedBytes, libraryBytes)
  const other = used - libraryBytes
  const pct = (b: number) => (b / totalBytes) * 100
  const usedPct = Math.round(pct(used))

  return (
    <section aria-labelledby="storage-heading" className="surface rounded-card p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 id="storage-heading" className="text-[13px] font-medium text-fg-muted">
            Storage
          </h2>
          <p className="mt-1 text-[22px] font-semibold tracking-tight">
            <span className="tabular">{formatBytes(used)}</span> <span className="text-[15px] font-normal text-fg-subtle">of {formatBytes(totalBytes)}</span>
          </p>
        </div>
        <p className="text-[13px] text-fg-subtle">
          <span className="tabular text-fg-muted">{formatBytes(totalBytes - used)}</span> available · {usedPct}% used
        </p>
      </div>
      <div
        role="meter"
        aria-label="Storage used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={usedPct}
        aria-valuetext={`${formatBytes(used)} of ${formatBytes(totalBytes)}`}
        className="mt-4 flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-white/[0.06]"
      >
        {byKind.map((x) => x.bytes > 0 && <span key={x.kind} className="h-full" style={{ width: `${Math.max(pct(x.bytes), 0.6)}%`, background: kindColor[x.kind] }} />)}
        {other > 0 && <span className="h-full bg-white/[0.18]" style={{ width: `${pct(other)}%` }} />}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-fg-subtle">
        {byKind.map((x) => (
          <li key={x.kind} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full" style={{ background: kindColor[x.kind] }} />
            {x.kind === 'audio' ? 'Audio' : `${kindLabel[x.kind]}s`} <span className="tabular text-fg-muted">{formatBytes(x.bytes)}</span>
          </li>
        ))}
        {other > 0 && (
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-white/[0.18]" />
            Renders, training data &amp; cache <span className="tabular text-fg-muted">{formatBytes(other)}</span>
          </li>
        )}
      </ul>
    </section>
  )
}
