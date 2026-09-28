import { useCallback, useSyncExternalStore } from 'react'
import type { Agent } from '@/types'
import { api } from '@/lib/api'
import { useWorkspace } from '@/state/workspace'
import { useToast } from '@/components/ui/Toast'

/* Archived agents are hidden from the workforce view for the session
   (deleted agents are removed from the workspace store). */
const removed = new Map<string, 'deleted' | 'archived'>()
const listeners = new Set<() => void>()
let version = 0
const emit = () => {
  version++
  listeners.forEach((l) => l())
}
const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useRemovedAgents() {
  useSyncExternalStore(subscribe, () => version)
  return removed
}

/** Persist a patch optimistically (workspace state) and through the API. */
export function useAgentActions(agent: Agent | undefined) {
  const { updateAgent, removeAgent } = useWorkspace()
  const toast = useToast()

  const save = useCallback(
    async (patch: Partial<Agent>, message?: { title: string; description?: string; tone?: 'success' | 'info' | 'error' }) => {
      if (!agent) return
      updateAgent(agent.id, { ...patch, updatedAt: new Date().toISOString() })
      try {
        await api.saveAgent({ ...agent, ...patch })
        if (message) toast(message)
      } catch {
        updateAgent(agent.id, agent)
        toast({ title: 'Could not save changes', description: 'Your edits were reverted. Try again.', tone: 'error' })
      }
    },
    [agent, updateAgent, toast],
  )

  const logActivity = useCallback(
    (text: string, kind: Agent['activity'][number]['kind']) =>
      agent ? [{ id: `act_${Date.now().toString(36)}`, text, kind, at: new Date().toISOString() }, ...agent.activity].slice(0, 12) : [],
    [agent],
  )

  const markRemoved = useCallback(
    (how: 'deleted' | 'archived') => {
      if (!agent) return
      if (how === 'deleted') removeAgent(agent.id)
      else {
        removed.set(agent.id, how)
        emit()
      }
    },
    [agent, removeAgent],
  )

  return { save, logActivity, markRemoved }
}
