import { useState } from 'react'
import { Bot, Plus, SearchX } from 'lucide-react'
import type { AgentStatus } from '@/types'
import { useWorkspace } from '@/state/workspace'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ButtonLink, Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchInput, SegmentedControl } from '@/components/ui/Form'
import { DemoNote, EmptyState } from '@/components/ui/States'
import { AgentCard } from '@/components/agents/AgentCard'
import { WorkforceSummary } from '@/components/agents/WorkforceSummary'
import { useRemovedAgents } from '@/components/agents/useAgentActions'

type Filter = 'all' | 'live' | 'paused' | 'draft'

export default function AgentsPage() {
  useDocumentTitle('My Agents')
  const { data, isDemo } = useWorkspace()
  const removed = useRemovedAgents()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const agents = (data?.agents ?? []).filter((a) => !removed.has(a.id))
  const count = (s: Filter) => (s === 'all' ? agents.length : agents.filter((a) => matches(a.status, s)).length)
  const visible = agents.filter((a) => {
    if (filter !== 'all' && !matches(a.status, filter)) return false
    const q = query.trim().toLowerCase()
    return !q || a.name.toLowerCase().includes(q) || a.purpose.toLowerCase().includes(q)
  })

  if (!data) return null

  return (
    <div>
      <PageHeader
        eyebrow="Workforce"
        title="My Agents"
        description="Deploy AI agents that work through voice, video, web, and API."
        actions={
          <ButtonLink to="/agents/new" variant="primary" leftIcon={<Plus />}>
            Build Agent
          </ButtonLink>
        }
      />

      {agents.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={<Bot />}
          title="Your AI workforce starts here."
          description="Give an agent a purpose, connect knowledge and let your avatar handle conversations on every channel."
          action={
            <ButtonLink to="/agents/new" variant="primary" leftIcon={<Plus />}>
              Build your first agent
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div className="mt-8">
            <WorkforceSummary agents={agents} />
            {isDemo && <DemoNote className="mt-3" />}
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedControl<Filter>
              label="Filter agents by status"
              value={filter}
              onChange={setFilter}
              className="no-scrollbar max-w-full overflow-x-auto"
              options={(['all', 'live', 'paused', 'draft'] as Filter[]).map((f) => ({
                value: f,
                label: (
                  <>
                    {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}
                    <span className="tabular text-[11px] text-fg-subtle">{count(f)}</span>
                  </>
                ),
              }))}
            />
            <SearchInput
              aria-label="Search agents"
              placeholder="Search agents"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full sm:w-72"
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState
              compact
              className="mt-6"
              icon={<SearchX />}
              title="No agents match"
              description="Try a different status or search term."
              action={
                <Button
                  onClick={() => {
                    setFilter('all')
                    setQuery('')
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <ul className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {visible.map((a, i) => (
                <li key={a.id} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <AgentCard agent={a} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function matches(status: AgentStatus, f: Filter) {
  if (f === 'live') return status === 'live' || status === 'deploying'
  return status === f
}
