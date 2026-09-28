import { lazy, Suspense } from 'react'
import type { Agent } from '@/types'
import { Skeleton } from '@/components/ui/States'

const AgentLiveTest = lazy(() => import('@/components/live/AgentLiveTest'))

export function LiveTestTab({ agent }: { agent: Agent }) {
  return (
    <Suspense
      fallback={
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" role="status" aria-label="Loading live test">
          <Skeleton className="aspect-video rounded-panel" />
          <Skeleton className="min-h-72 rounded-panel" />
        </div>
      }
    >
      <AgentLiveTest agent={agent} />
    </Suspense>
  )
}
