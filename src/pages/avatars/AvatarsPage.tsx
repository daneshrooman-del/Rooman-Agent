import { useMemo, useState } from 'react'
import { ArrowUpDown, Plus, ScanFace, SearchX } from 'lucide-react'
import type { Avatar } from '@/types'
import { useWorkspace } from '@/state/workspace'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { pluralize } from '@/lib/format'
import { Button, ButtonLink } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchInput, SegmentedControl, Select } from '@/components/ui/Form'
import { DemoNote, EmptyState } from '@/components/ui/States'
import { AvatarCard } from '@/components/avatar/AvatarCard'
import { CreateAvatarTile } from '@/components/avatar/CreateAvatarTile'

type StatusFilter = 'all' | 'ready' | 'training' | 'failed'
type SortKey = 'newest' | 'name' | 'used'

const totalUse = (a: Avatar) => a.usage.videos + a.usage.agents + a.usage.liveSessions

const sorters: Record<SortKey, (a: Avatar, b: Avatar) => number> = {
  newest: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  name: (a, b) => a.name.localeCompare(b.name),
  used: (a, b) => totalUse(b) - totalUse(a),
}

export default function AvatarsPage() {
  useDocumentTitle('My Avatars')
  const { data, isDemo } = useWorkspace()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortKey>('newest')

  const avatars = useMemo(() => data?.avatars ?? [], [data])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return avatars
      .filter((a) => status === 'all' || a.status === status)
      .filter((a) => !q || `${a.name} ${a.kind} ${a.languages.join(' ')}`.toLowerCase().includes(q))
      .sort(sorters[sort])
  }, [avatars, query, status, sort])

  if (!data) return null

  const count = (s: StatusFilter) => (s === 'all' ? avatars.length : avatars.filter((a) => a.status === s).length)
  const readyCount = count('ready')
  const powering = avatars.reduce((n, a) => n + totalUse(a), 0)
  const filtered = query.trim() !== '' || status !== 'all'

  return (
    <div>
      <PageHeader
        eyebrow="Identity layer"
        title="My Avatars"
        description="Create reusable digital identities for videos, live conversations, and AI agents."
        actions={
          avatars.length > 0 && (
            <ButtonLink to="/avatars/new" variant="primary" leftIcon={<Plus aria-hidden />}>
              Create Avatar
            </ButtonLink>
          )
        }
      />

      {avatars.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={<ScanFace aria-hidden />}
          title="You don't have an avatar yet."
          description="Create your first AI avatar from a short video of yourself. One identity will power your videos, live conversations and AI agents."
          action={
            <ButtonLink to="/avatars/new" variant="primary" size="lg" leftIcon={<Plus aria-hidden />}>
              Create your first avatar
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div className="mt-8 flex flex-col gap-3 animate-fade-up lg:flex-row lg:items-center" style={{ animationDelay: '60ms' }}>
            <SearchInput
              className="w-full lg:max-w-xs"
              placeholder="Search avatars"
              aria-label="Search avatars"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-1 lg:justify-between">
              <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
                <SegmentedControl
                  label="Filter by status"
                  value={status}
                  onChange={setStatus}
                  options={(['all', 'ready', 'training', 'failed'] as const).map((s) => ({
                    value: s,
                    label: (
                      <>
                        <span className="capitalize">{s}</span>
                        <span className="tabular text-fg-subtle">{count(s)}</span>
                      </>
                    ),
                  }))}
                />
              </div>
              <Select
                aria-label="Sort avatars"
                className="sm:w-48"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                leading={<ArrowUpDown className="size-4 text-fg-subtle" aria-hidden />}
                options={[
                  { value: 'newest', label: 'Newest first' },
                  { value: 'name', label: 'Name (A–Z)' },
                  { value: 'used', label: 'Most used' },
                ]}
              />
            </div>
          </div>

          <p className="mt-5 text-[13px] text-fg-subtle" aria-live="polite">
            {filtered ? `${pluralize(visible.length, 'avatar')} shown` : `${pluralize(avatars.length, 'avatar')} · ${readyCount} ready`}
            {!filtered && powering > 0 && <> · powering {pluralize(powering, 'experience')}</>}
          </p>

          {visible.length === 0 ? (
            <EmptyState
              className="mt-5"
              compact
              icon={<SearchX aria-hidden />}
              title="No avatars match"
              description={query.trim() ? `Nothing matches “${query.trim()}”${status !== 'all' ? ` in ${status}` : ''}. Try another name or clear the filters.` : `You have no ${status} avatars right now.`}
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('')
                    setStatus('all')
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <ul className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-4">
              {visible.map((a, i) => (
                <li key={a.id} className="animate-fade-up" style={{ animationDelay: `${80 + i * 60}ms` }}>
                  <AvatarCard avatar={a} />
                </li>
              ))}
              {!filtered && (
                <li className="animate-fade-up" style={{ animationDelay: `${80 + visible.length * 60}ms` }}>
                  <CreateAvatarTile className="h-full" />
                </li>
              )}
            </ul>
          )}

          {isDemo && <DemoNote className="mt-10">Sample avatars — connect your backend to see your own identities.</DemoNote>}
        </>
      )}
    </div>
  )
}
