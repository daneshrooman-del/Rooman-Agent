import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clapperboard, Plus, SearchX, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { formatMinutes, pluralize } from '@/lib/format'
import type { Video, VideoStatus } from '@/types'
import { useWorkspace } from '@/state/workspace'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { Button, ButtonLink } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchInput, Select } from '@/components/ui/Form'
import { Tabs } from '@/components/ui/Tabs'
import { DemoNote, EmptyState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { AvatarChip } from '@/components/avatar/AvatarPreview'
import { VideoCard, type VideoCardActions } from '@/components/video/VideoCard'
import { VideoDetailDialog } from '@/components/video/VideoDetailDialog'
import { useVideoActions } from '@/components/video/useVideoActions'
import { useAdvanceGenerating } from '@/components/video/useAdvanceGenerating'
import { draftFromVideo } from '@/components/video/studio'

type Filter = 'all' | 'generating' | 'ready' | 'failed'

const matches = (f: Filter, s: VideoStatus) => f === 'all' || (f === 'generating' ? s === 'generating' || s === 'queued' : s === f)

const empty: Record<Filter, { title: string; description: string; icon: ReactNode }> = {
  all: { title: 'No videos yet', description: 'Direct your avatar with a sentence and your first video appears here.', icon: <Clapperboard /> },
  generating: { title: 'Nothing rendering right now', description: 'Videos appear here while your avatar is creating them.', icon: <Sparkles /> },
  ready: { title: 'No finished videos yet', description: 'Once a render completes it lands here, ready to share.', icon: <CheckCircle2 /> },
  failed: { title: 'No failed renders', description: 'Every video went through. Nice.', icon: <AlertTriangle /> },
}

export default function VideosPage() {
  useDocumentTitle('Videos')
  const { data, isDemo, avatarById, primaryAvatar, updateVideo } = useWorkspace()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { share, download, duplicate } = useVideoActions()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [avatarFilter, setAvatarFilter] = useState('all')

  useAdvanceGenerating(true)

  const videos = useMemo(() => data?.videos ?? [], [data?.videos])
  const openId = params.get('v')
  const openVideo = videos.find((v) => v.id === openId)

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase()
    return videos.filter(
      (v) =>
        (avatarFilter === 'all' || v.avatarId === avatarFilter) &&
        (!q || v.title.toLowerCase().includes(q) || v.prompt.toLowerCase().includes(q) || (avatarById(v.avatarId)?.name.toLowerCase().includes(q) ?? false)),
    )
  }, [videos, query, avatarFilter, avatarById])

  const count = (f: Filter) => scoped.filter((v) => matches(f, v.status)).length
  const shown = scoped.filter((v) => matches(filter, v.status))
  const narrowed = query.trim() !== '' || avatarFilter !== 'all'
  const ready = videos.filter((v) => v.status === 'ready')
  const runtime = ready.reduce((n, v) => n + v.durationSec, 0)

  const avatarsWithVideos = (data?.avatars ?? []).filter((a) => videos.some((v) => v.avatarId === a.id))

  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('v', id)
    else next.delete('v')
    setParams(next, { replace: true })
  }

  const edit = (v: Video) => navigate(`/create?avatar=${v.avatarId}`, { state: draftFromVideo(v) })

  const retry = async (v: Video) => {
    try {
      updateVideo(v.id, await api.retryVideo(v.id))
      toast({ title: 'Retrying render', description: `${v.title} is back in the queue.`, tone: 'info' })
    } catch {
      toast({ title: 'Could not retry', description: 'Please try again in a moment.', tone: 'error' })
    }
  }

  const actions: VideoCardActions = {
    onPlay: (v) => setOpen(v.id),
    onEdit: edit,
    onDuplicate: (v) => void duplicate(v),
    onDownload: download,
    onShare: (v) => void share(v),
    onRetry: (v) => void retry(v),
  }

  const e = empty[filter]

  return (
    <div>
      <PageHeader
        title="Your Videos"
        description="Every video your avatars have created."
        actions={
          <ButtonLink to={`/create${primaryAvatar ? `?avatar=${primaryAvatar.id}` : ''}`} variant="primary" leftIcon={<Plus />}>
            Create Video
          </ButtonLink>
        }
      />

      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-subtle">
        <span>
          <span className="tabular text-fg-muted">{pluralize(videos.length, 'video')}</span>
        </span>
        <span className="size-0.5 rounded-full bg-fg-subtle" aria-hidden />
        <span>
          <span className="tabular text-fg-muted">{formatMinutes(runtime)}</span> of finished footage
        </span>
        <span className="size-0.5 rounded-full bg-fg-subtle" aria-hidden />
        <span>
          <span className="tabular text-fg-muted">{pluralize(avatarsWithVideos.length, 'avatar')}</span> on camera
        </span>
      </p>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Tabs
          label="Filter videos by status"
          idBase="videos"
          value={filter}
          onChange={setFilter}
          className="lg:border-b-0"
          items={[
            { value: 'all', label: 'All', count: count('all') },
            { value: 'generating', label: 'Generating', count: count('generating') },
            { value: 'ready', label: 'Ready', count: count('ready') },
            { value: 'failed', label: 'Failed', count: count('failed') },
          ]}
        />
        <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-[1fr_200px] lg:w-[460px]">
          <SearchInput placeholder="Search titles or prompts" aria-label="Search videos" value={query} onChange={(ev) => setQuery(ev.target.value)} />
          <Select
            aria-label="Filter by avatar"
            value={avatarFilter}
            onChange={(ev) => setAvatarFilter(ev.target.value)}
            leading={avatarFilter === 'all' ? undefined : <AvatarChip avatar={avatarById(avatarFilter)} size={20} />}
            options={[{ value: 'all', label: 'All avatars' }, ...(data?.avatars ?? []).map((a) => ({ value: a.id, label: a.name }))]}
          />
        </div>
      </div>

      <section id={`videos-panel-${filter}`} role="tabpanel" aria-labelledby={`videos-tab-${filter}`} className="mt-6">
        {shown.length === 0 ? (
          narrowed ? (
            <EmptyState
              icon={<SearchX />}
              title="No videos match"
              description="Try a different search or show every avatar."
              action={
                <Button
                  onClick={() => {
                    setQuery('')
                    setAvatarFilter('all')
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={e.icon}
              title={e.title}
              description={e.description}
              action={
                filter === 'failed' || filter === 'ready' ? (
                  <Button onClick={() => setFilter('all')}>Show all videos</Button>
                ) : (
                  <ButtonLink to="/create" variant="primary" leftIcon={<Plus />}>
                    Create Video
                  </ButtonLink>
                )
              }
            />
          )
        ) : (
          <ul className="grid grid-cols-1 gap-x-5 gap-y-8 min-[560px]:grid-cols-2 xl:grid-cols-3">
            {shown.map((v, i) => (
              <li key={v.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <VideoCard video={v} actions={actions} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {isDemo && <DemoNote className="mt-12">Sample videos — renders in progress are simulated in demo mode.</DemoNote>}

      <VideoDetailDialog
        video={openVideo}
        onClose={() => setOpen(null)}
        onEdit={edit}
        onDuplicate={(v) => {
          const c = duplicate(v)
          setOpen(c.id)
        }}
        onDownload={download}
        onShare={(v) => void share(v)}
      />
    </div>
  )
}
