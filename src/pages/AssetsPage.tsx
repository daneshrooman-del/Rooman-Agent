import { useMemo, useState } from 'react'
import { LayoutGrid, List, UploadCloud } from 'lucide-react'
import { useWorkspace } from '@/state/workspace'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { api } from '@/lib/api'
import { pluralize } from '@/lib/format'
import type { Asset, Workspace } from '@/types'
import { Button, DemoNote, PageHeader, SearchInput, SegmentedControl, Select, TabPanel, Tabs, useToast } from '@/components/ui'
import { AssetCard, AssetRow, type AssetActions } from '@/components/assets/AssetCard'
import { AssetPreviewDialog, DeleteAssetDialog, RenameAssetDialog, UploadAssetDialog } from '@/components/assets/AssetDialogs'
import { AssetEmpty, NoResults } from '@/components/assets/AssetEmpty'
import { StorageBar } from '@/components/assets/StorageBar'
import { useAssetLibrary } from '@/components/assets/useAssetLibrary'
import { categories, sortAssets, type AssetCategory, type AssetSort, type LibraryAsset } from '@/components/assets/assetMeta'

export default function AssetsPage() {
  useDocumentTitle('Assets')
  const { data } = useWorkspace()
  if (!data) return null
  return <AssetsView initial={data.assets} storage={data.workspace.storage} />
}

function AssetsView({ initial, storage }: { initial: Asset[]; storage: Workspace['storage'] }) {
  const { isDemo, avatarById } = useWorkspace()
  const toast = useToast()
  const lib = useAssetLibrary(initial)
  const [category, setCategory] = useState<AssetCategory>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<AssetSort>('newest')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [preview, setPreview] = useState<LibraryAsset | null>(null)
  const [renaming, setRenaming] = useState<LibraryAsset | null>(null)
  const [deleting, setDeleting] = useState<LibraryAsset | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  const counts = useMemo(() => {
    const c: Record<AssetCategory, number> = { all: lib.assets.length, video: 0, audio: 0, avatar: 0, document: 0, image: 0 }
    lib.assets.forEach((a) => c[a.kind]++)
    return c
  }, [lib.assets])

  const inCategory = category === 'all' ? lib.assets : lib.assets.filter((a) => a.kind === category)
  const q = query.trim().toLowerCase()
  const visible = sortAssets(
    q ? inCategory.filter((a) => a.name.toLowerCase().includes(q) || (avatarById(a.avatarId)?.name.toLowerCase().includes(q) ?? false)) : inCategory,
    sort,
  )
  // keep the preview dialog in sync with live processing progress
  const livePreview = preview ? (lib.assets.find((x) => x.id === preview.id) ?? null) : null

  const actions: AssetActions = {
    onPreview: setPreview,
    onRename: setRenaming,
    onDelete: setDeleting,
    onDownload: async (a) => {
      const url = await api.getAssetDownloadUrl(a.id)
      if (url) window.open(url, '_blank', 'noopener')
      toast({ title: 'Download started', description: isDemo ? `${a.name} — demo file, nothing is saved.` : a.name })
    },
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Assets"
        description="Everything your avatars use and produce — reference footage, voice samples, generated videos, knowledge documents and backdrops, in one library."
        actions={
          <Button variant="primary" leftIcon={<UploadCloud />} onClick={() => setUploadOpen(true)}>
            Upload
          </Button>
        }
      />

      <div className="mt-8 animate-fade-up" style={{ animationDelay: '60ms' }}>
        <StorageBar assets={lib.assets} usedBytes={storage.usedBytes} totalBytes={storage.totalBytes} />
      </div>

      <div className="mt-10">
        <Tabs
          idBase="assets"
          label="Asset categories"
          value={category}
          onChange={setCategory}
          items={categories.map((c) => ({ value: c.value, label: c.label, count: counts[c.value] }))}
        />
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            aria-label="Search assets"
            placeholder="Search by name or avatar"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:max-w-sm sm:flex-1"
          />
          <div className="flex items-center gap-2 sm:ml-auto">
            <Select
              aria-label="Sort assets"
              value={sort}
              onChange={(e) => setSort(e.target.value as AssetSort)}
              className="flex-1 sm:w-44 sm:flex-none"
              options={[
                { value: 'newest', label: 'Newest first' },
                { value: 'name', label: 'Name A–Z' },
                { value: 'size', label: 'Largest first' },
              ]}
            />
            <SegmentedControl
              label="Layout"
              value={view}
              onChange={setView}
              className="h-10"
              options={[
                { value: 'grid', label: <span className="sr-only">Grid view</span>, icon: <LayoutGrid aria-hidden /> },
                { value: 'list', label: <span className="sr-only">List view</span>, icon: <List aria-hidden /> },
              ]}
            />
          </div>
        </div>

        <TabPanel idBase="assets" value={category} className="mt-6">
          <p className="sr-only" aria-live="polite">
            {pluralize(visible.length, 'asset')} shown
          </p>
          {inCategory.length === 0 ? (
            <AssetEmpty category={category} onUpload={() => setUploadOpen(true)} />
          ) : visible.length === 0 ? (
            <NoResults query={query} onClear={() => setQuery('')} />
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((a, i) => (
                <AssetCard key={a.id} asset={a} avatar={avatarById(a.avatarId)} actions={actions} index={i} />
              ))}
            </div>
          ) : (
            <div className="surface overflow-hidden rounded-card shadow-soft">
              <div className="hidden items-center gap-4 border-b border-line px-4 py-2.5 text-[12px] font-medium text-fg-subtle sm:flex" aria-hidden>
                <span className="w-24">Preview</span>
                <span className="flex-1">Name</span>
                <span className="hidden w-32 md:block">Avatar</span>
                <span className="w-20 text-right">Size</span>
                <span className="hidden w-28 text-right lg:block">Added</span>
                <span className="w-8" />
              </div>
              <ul className="divide-y divide-line">
                {visible.map((a) => (
                  <AssetRow key={a.id} asset={a} avatar={avatarById(a.avatarId)} actions={actions} />
                ))}
              </ul>
            </div>
          )}
        </TabPanel>
      </div>

      {isDemo && <DemoNote className="mt-10">Sample library — uploads, renames and deletes stay in this browser session.</DemoNote>}

      <AssetPreviewDialog asset={livePreview} avatar={avatarById(preview?.avatarId)} onClose={() => setPreview(null)} onDownload={actions.onDownload} />
      <RenameAssetDialog
        asset={renaming}
        onClose={() => setRenaming(null)}
        onRename={async (a, name) => {
          await lib.rename(a.id, name)
          setRenaming(null)
          toast({ title: 'Asset renamed', description: name })
        }}
      />
      <DeleteAssetDialog
        asset={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async (a) => {
          await lib.remove(a.id)
          setDeleting(null)
          toast({ title: 'Asset deleted', description: a.name })
        }}
      />
      <UploadAssetDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onFiles={async (files) => {
          try {
            await lib.upload(files)
            toast({ title: files.length === 1 ? 'Uploading 1 file' : `Uploading ${files.length} files`, description: 'Processing in the background — you can keep working.', tone: 'info' })
          } catch {
            toast({ title: 'Upload failed', description: 'Check your connection and try again.', tone: 'error' })
          }
        }}
      />
    </div>
  )
}
