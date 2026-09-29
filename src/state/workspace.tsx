/* Workspace state: one provider that loads the workspace snapshot once
   and exposes typed selectors + mutations. Pages never fetch directly. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, isDemoMode, type WorkspaceSnapshot } from '@/lib/api'
import type { Agent, Avatar, Video } from '@/types'

type Status = 'loading' | 'ready' | 'error'

interface WorkspaceContextValue {
  status: Status
  error: string | null
  isDemo: boolean
  data: WorkspaceSnapshot | null
  reload: () => void
  /** The avatar that powers everything by default */
  primaryAvatar: Avatar | undefined
  avatarById: (id: string | undefined) => Avatar | undefined
  voiceName: (id: string | undefined) => string
  addAvatar: (a: Avatar) => void
  updateAvatar: (id: string, patch: Partial<Avatar>) => void
  removeAvatar: (id: string) => void
  addVideo: (v: Video) => void
  updateVideo: (id: string, patch: Partial<Video>) => void
  removeVideo: (id: string) => void
  addAgent: (a: Agent) => void
  updateAgent: (id: string, patch: Partial<Agent>) => void
  removeAgent: (id: string) => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<WorkspaceSnapshot | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    api
      .loadWorkspace()
      .then((snap) => {
        if (cancelled) return
        setData(snap)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Could not load workspace')
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [nonce])

  const patch = useCallback(<K extends keyof WorkspaceSnapshot>(key: K, fn: (list: WorkspaceSnapshot[K]) => WorkspaceSnapshot[K]) => {
    setData((d) => (d ? { ...d, [key]: fn(d[key]) } : d))
  }, [])

  const value = useMemo<WorkspaceContextValue>(() => {
    const avatars = data?.avatars ?? []
    return {
      status,
      error,
      isDemo: isDemoMode,
      data,
      reload: () => setNonce((n) => n + 1),
      primaryAvatar: avatars.find((a) => a.primary) ?? avatars.find((a) => a.status === 'ready') ?? avatars[0],
      avatarById: (id) => avatars.find((a) => a.id === id),
      voiceName: (id) => data?.voices.find((v) => v.id === id)?.name ?? avatars.find((a) => a.voiceId === id)?.voiceLabel ?? '—',
      addAvatar: (a) => patch('avatars', (l) => [a, ...l]),
      updateAvatar: (id, p) => patch('avatars', (l) => l.map((a) => (a.id === id ? { ...a, ...p } : a))),
      removeAvatar: (id) => patch('avatars', (l) => l.filter((a) => a.id !== id)),
      addVideo: (v) => patch('videos', (l) => [v, ...l]),
      updateVideo: (id, p) => patch('videos', (l) => l.map((v) => (v.id === id ? { ...v, ...p } : v))),
      removeVideo: (id) => patch('videos', (l) => l.filter((v) => v.id !== id)),
      addAgent: (a) => patch('agents', (l) => [a, ...l]),
      updateAgent: (id, p) => patch('agents', (l) => l.map((a) => (a.id === id ? { ...a, ...p } : a))),
      removeAgent: (id) => patch('agents', (l) => l.filter((a) => a.id !== id)),
    }
  }, [status, error, data, patch])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return ctx
}
