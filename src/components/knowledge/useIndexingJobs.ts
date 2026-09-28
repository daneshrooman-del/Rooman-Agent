import { useEffect, useRef } from 'react'
import type { Agent, KnowledgeSource } from '@/types'
import { api } from '@/lib/api'
import { useWorkspace } from '@/state/workspace'
import { useToast } from '@/components/ui/Toast'

const retried = new Set<string>()
/** Allow a failed source to succeed when retried. */
export const markRetried = (id: string) => void retried.add(id)

/** Chunk estimate for a finished document (~1 chunk per 12 KB, URLs ~40). */
export const estimateChunks = (k: KnowledgeSource) => (k.type === 'url' ? 38 + (k.name.length % 9) : Math.max(4, Math.round(k.sizeBytes / 12_000)))

/**
 * Drives the knowledge indexing pipeline (queued → processing → ready).
 * In demo mode progress is simulated here; with a real backend, replace the
 * ticker with polling of the indexing status endpoint.
 */
export function useIndexingJobs(agent: Agent | undefined) {
  const { data, updateAgent } = useWorkspace()
  const toast = useToast()
  const latest = useRef(agent)
  latest.current = data?.agents.find((a) => a.id === agent?.id) ?? agent
  const busy = !!agent?.knowledge.some((k) => k.status === 'queued' || k.status === 'processing')

  useEffect(() => {
    if (!busy) return
    const timer = window.setInterval(() => {
      const a = latest.current
      if (!a) return
      const finished: string[] = []
      const knowledge = a.knowledge.map<KnowledgeSource>((k) => {
        if (k.status === 'queued') return { ...k, status: 'processing', progress: 3 }
        if (k.status !== 'processing') return k
        const step = 6 + ((k.id.charCodeAt(k.id.length - 1) + (k.progress ?? 0)) % 9)
        const progress = Math.min(100, (k.progress ?? 0) + step)
        if (progress < 100) return { ...k, progress }
        if (k.sizeBytes === 0 && k.type !== 'url' && !retried.has(k.id)) return { ...k, status: 'failed', progress: undefined }
        finished.push(k.name)
        return { ...k, status: 'ready', progress: undefined, chunks: estimateChunks(k), updatedAt: new Date().toISOString() }
      })
      updateAgent(a.id, { knowledge })
      if (finished.length) {
        void api.saveAgent({ ...a, knowledge })
        toast({ title: finished.length === 1 ? `${finished[0]} is ready` : `${finished.length} sources ready`, description: 'Indexed and available to the agent.' })
      }
    }, 450)
    return () => window.clearInterval(timer)
  }, [busy, updateAgent, toast])
}
