import { SearchX, UploadCloud, Video as VideoIcon } from 'lucide-react'
import { Button, ButtonLink, EmptyState } from '@/components/ui'
import { kindIcon, type AssetCategory } from './assetMeta'

const copy: Record<AssetCategory, { title: string; description: string }> = {
  all: { title: 'No assets yet', description: 'Upload reference footage, voice samples, documents or images — generated videos land here automatically.' },
  video: { title: 'No videos yet', description: 'Generated videos and reference takes appear here, ready to reuse or download.' },
  audio: { title: 'No audio yet', description: 'Voice samples and sound files you upload or record live here.' },
  avatar: { title: 'No avatars yet', description: 'Create your digital twin once — it powers every video, live session and agent.' },
  document: { title: 'No documents yet', description: 'PDFs, spreadsheets and docs you upload become knowledge your agents can use.' },
  image: { title: 'No images yet', description: 'Backdrops, logos and brand imagery for your video scenes.' },
}

export function AssetEmpty({ category, onUpload }: { category: AssetCategory; onUpload: () => void }) {
  const Icon = category === 'all' ? UploadCloud : kindIcon[category]
  return (
    <EmptyState
      icon={<Icon />}
      title={copy[category].title}
      description={copy[category].description}
      action={
        category === 'avatar' ? (
          <ButtonLink to="/avatars/new" variant="primary">
            Create avatar
          </ButtonLink>
        ) : category === 'video' ? (
          <>
            <ButtonLink to="/create" variant="primary" leftIcon={<VideoIcon />}>
              Create video
            </ButtonLink>
            <Button onClick={onUpload}>Upload</Button>
          </>
        ) : (
          <Button variant="primary" leftIcon={<UploadCloud />} onClick={onUpload}>
            Upload files
          </Button>
        )
      }
    />
  )
}

export function NoResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <EmptyState
      compact
      icon={<SearchX />}
      title="No matching assets"
      description={`Nothing matches “${query}”. Try a different name or clear the search.`}
      action={<Button onClick={onClear}>Clear search</Button>}
    />
  )
}
