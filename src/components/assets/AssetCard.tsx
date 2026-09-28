import { Link } from 'react-router-dom'
import { Download, Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatBytes, formatDate, timeAgo } from '@/lib/format'
import type { Avatar } from '@/types'
import { Button, Menu, ProgressBar } from '@/components/ui'
import { AvatarChip } from '@/components/avatar/AvatarPreview'
import { AssetPreview } from './AssetPreview'
import { kindIcon, kindLabel, type LibraryAsset } from './assetMeta'

export interface AssetActions {
  onPreview: (a: LibraryAsset) => void
  onDownload: (a: LibraryAsset) => void
  onRename: (a: LibraryAsset) => void
  onDelete: (a: LibraryAsset) => void
}

function AssetMenu({ asset, actions }: { asset: LibraryAsset; actions: AssetActions }) {
  const processing = asset.status === 'processing'
  return (
    <Menu
      label={`Actions for ${asset.name}`}
      className="relative z-10"
      items={[
        { label: 'Preview', icon: <Eye />, onSelect: () => actions.onPreview(asset) },
        { label: 'Download', icon: <Download />, onSelect: () => actions.onDownload(asset), disabled: processing },
        { label: 'Rename', icon: <Pencil />, onSelect: () => actions.onRename(asset) },
        { label: 'Delete', icon: <Trash2 />, onSelect: () => actions.onDelete(asset), danger: true },
      ]}
      trigger={(p) => (
        <Button {...p} variant="ghost" size="sm" iconOnly aria-label={`More actions for ${asset.name}`} className="size-10 sm:size-8">
          <MoreHorizontal />
        </Button>
      )}
    />
  )
}

function LinkedAvatar({ avatar }: { avatar: Avatar }) {
  return (
    <Link
      to={`/avatars/${avatar.id}`}
      className="relative z-10 inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border border-line bg-white/[0.03] pl-0.5 pr-2 text-[12px] text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
    >
      <AvatarChip avatar={avatar} size={20} />
      <span className="truncate">{avatar.name}</span>
    </Link>
  )
}

function ProcessingOverlay({ progress = 0 }: { progress?: number }) {
  return (
    <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-2.5 bg-black/60 backdrop-blur-[2px]" aria-live="polite">
      <span className="text-[12px] font-medium text-fg">Processing · {progress}%</span>
      <ProgressBar value={progress} className="w-1/2" label="Upload processing" />
    </div>
  )
}

export function AssetCard({ asset, avatar, actions, index = 0 }: { asset: LibraryAsset; avatar: Avatar | undefined; actions: AssetActions; index?: number }) {
  const Icon = kindIcon[asset.kind]
  return (
    <article
      className="surface group relative flex animate-fade-up flex-col rounded-card focus-within:z-20 shadow-soft transition-[transform,border-color,box-shadow] duration-300 ease-out-soft hover:-translate-y-0.5 hover:border-line-strong"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <div className={cn('relative overflow-hidden rounded-t-card', asset.kind === 'audio' && 'z-10')}>
        <AssetPreview asset={asset} avatar={avatar} />
        {asset.status === 'processing' && <ProcessingOverlay progress={asset.progress} />}
      </div>
      <div className="flex items-start gap-2 p-4 pr-2.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-medium tracking-normal">
            <button
              type="button"
              onClick={() => actions.onPreview(asset)}
              className="text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-accent"
              title={asset.name}
            >
              {asset.name}
            </button>
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 whitespace-nowrap text-[12px] text-fg-subtle">
            <Icon className="size-3.5" aria-hidden />
            <span>{kindLabel[asset.kind]}</span>
            <span className="tabular">
              <span aria-hidden>· </span>
              {formatBytes(asset.sizeBytes)}
            </span>
            <span>
              <span aria-hidden>· </span>
              <time dateTime={asset.createdAt} title={formatDate(asset.createdAt)}>
                {timeAgo(asset.createdAt)}
              </time>
            </span>
          </p>
          {avatar && (
            <div className="mt-3">
              <LinkedAvatar avatar={avatar} />
            </div>
          )}
        </div>
        <AssetMenu asset={asset} actions={actions} />
      </div>
    </article>
  )
}

export function AssetRow({ asset, avatar, actions }: { asset: LibraryAsset; avatar: Avatar | undefined; actions: AssetActions }) {
  const Icon = kindIcon[asset.kind]
  return (
    <li className="group relative flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.025] sm:gap-4 sm:px-4">
      <div className="relative w-20 shrink-0 overflow-hidden rounded-[10px] ring-1 ring-line sm:w-24">
        <AssetPreview asset={asset} avatar={avatar} variant="thumb" />
        {asset.status === 'processing' && (
          <div className="absolute inset-0 flex items-end bg-black/55 p-1.5">
            <ProgressBar value={asset.progress ?? 0} label="Upload processing" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => actions.onPreview(asset)}
          className="block max-w-full truncate text-left text-[14px] font-medium after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-accent"
        >
          {asset.name}
        </button>
        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-fg-subtle">
          <Icon className="size-3.5" aria-hidden />
          {kindLabel[asset.kind]}
          <span className="sm:hidden">· {formatBytes(asset.sizeBytes)}</span>
          {asset.status === 'processing' && <span className="text-accent">· Processing {asset.progress}%</span>}
        </p>
      </div>
      <div className="hidden w-32 md:block">{avatar ? <LinkedAvatar avatar={avatar} /> : <span className="text-[12px] text-fg-subtle">—</span>}</div>
      <span className="tabular hidden w-20 text-right text-[13px] text-fg-muted sm:block">{formatBytes(asset.sizeBytes)}</span>
      <time dateTime={asset.createdAt} className="hidden w-28 text-right text-[13px] text-fg-subtle lg:block">
        {formatDate(asset.createdAt)}
      </time>
      <AssetMenu asset={asset} actions={actions} />
    </li>
  )
}
