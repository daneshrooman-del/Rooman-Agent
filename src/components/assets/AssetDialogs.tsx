import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { Download, UploadCloud } from 'lucide-react'
import { formatBytes, formatDate, formatDuration } from '@/lib/format'
import type { Avatar } from '@/types'
import { Button, Dialog, Field, Input, UploadZone } from '@/components/ui'
import { AvatarChip } from '@/components/avatar/AvatarPreview'
import { AssetPreview } from './AssetPreview'
import { baseName, fileExt, kindLabel, type LibraryAsset } from './assetMeta'

export function AssetPreviewDialog({
  asset,
  avatar,
  onClose,
  onDownload,
}: {
  asset: LibraryAsset | null
  avatar: Avatar | undefined
  onClose: () => void
  onDownload: (a: LibraryAsset) => void
}) {
  const rows: [string, ReactNode][] = asset
    ? [
        ['Type', kindLabel[asset.kind]],
        ['Format', fileExt(asset.name) || (asset.kind === 'avatar' ? 'Avatar model' : '—')],
        ['Size', formatBytes(asset.sizeBytes)],
        ['Added', formatDate(asset.createdAt)],
        ...(asset.durationSec ? ([['Duration', formatDuration(asset.durationSec)]] as [string, ReactNode][]) : []),
        [
          'Linked avatar',
          avatar ? (
            <span className="inline-flex items-center gap-1.5">
              <AvatarChip avatar={avatar} size={18} />
              {avatar.name}
            </span>
          ) : (
            'None'
          ),
        ],
      ]
    : []
  return (
    <Dialog
      open={!!asset}
      onClose={onClose}
      size="lg"
      title={asset?.name ?? ''}
      description={asset && avatar ? `Part of ${avatar.name}'s identity — reusable across videos, Live AI and agents.` : undefined}
      footer={
        asset && (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" leftIcon={<Download />} disabled={asset.status === 'processing'} onClick={() => onDownload(asset)}>
              Download
            </Button>
          </>
        )
      }
    >
      {asset && (
        <div className="flex flex-col gap-5">
          <div className="overflow-hidden rounded-card ring-1 ring-line">
            <AssetPreview asset={asset} avatar={avatar} variant="large" />
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {rows.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[12px] text-fg-subtle">{k}</dt>
                <dd className="mt-0.5 truncate text-[14px] text-fg">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Dialog>
  )
}

export function RenameAssetDialog({ asset, onClose, onRename }: { asset: LibraryAsset | null; onClose: () => void; onRename: (a: LibraryAsset, name: string) => Promise<void> }) {
  const id = useId()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const ext = asset ? fileExt(asset.name) : ''

  useEffect(() => {
    if (asset) {
      setValue(baseName(asset.name))
      setError(null)
    }
  }, [asset])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!asset) return
    const name = value.trim()
    if (!name) return setError('Give the asset a name.')
    if (/[\/:*?"<>|]/.test(name)) return setError('Names can’t contain \ / : * ? " < > |')
    setSaving(true)
    await onRename(asset, ext ? `${name}.${ext.toLowerCase()}` : name)
    setSaving(false)
  }

  return (
    <Dialog
      open={!!asset}
      onClose={onClose}
      size="sm"
      title="Rename asset"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={`${id}-form`} loading={saving}>
            Save name
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={submit} noValidate>
        <Field label="Name" htmlFor={id} error={error} hint={ext ? `The .${ext.toLowerCase()} extension is kept.` : undefined}>
          <Input id={id} value={value} autoFocus aria-invalid={!!error} onChange={(e) => (setValue(e.target.value), setError(null))} maxLength={120} />
        </Field>
      </form>
    </Dialog>
  )
}

export function DeleteAssetDialog({ asset, onClose, onConfirm }: { asset: LibraryAsset | null; onClose: () => void; onConfirm: (a: LibraryAsset) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      open={!!asset}
      onClose={onClose}
      size="sm"
      title="Delete this asset?"
      description={asset ? `“${asset.name}” will be removed from your workspace. Videos and agents that already use it keep working.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={busy}
            onClick={async () => {
              if (!asset) return
              setBusy(true)
              await onConfirm(asset)
              setBusy(false)
            }}
          >
            Delete asset
          </Button>
        </>
      }
    />
  )
}

export function UploadAssetDialog({ open, onClose, onFiles }: { open: boolean; onClose: () => void; onFiles: (files: File[]) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Upload assets" description="Add reference footage, voice samples, documents or images. Files process in the background.">
      <UploadZone
        multiple
        icon={<UploadCloud />}
        title="Drop files to upload"
        description="MP4, MOV, WAV, MP3, PDF, DOCX, CSV, XLSX, PNG, JPG or SVG · up to 2 GB each"
        accept="video/*,audio/*,image/*,.pdf,.docx,.pptx,.csv,.xlsx,.txt"
        onFiles={(files) => {
          onFiles(files)
          onClose()
        }}
      />
    </Dialog>
  )
}

