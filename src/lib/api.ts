/* ------------------------------------------------------------------
   API client — the single integration point with the backend.

   • When VITE_API_URL is set, every call goes to the real REST API.
   • When it is not set, calls resolve against the demo dataset in
     src/data/demo.ts and the UI marks the workspace as demo data.

   Endpoints below are the contract the frontend expects; wire the
   backend to match (or adjust here — no page talks to fetch directly).
   ------------------------------------------------------------------ */
import * as demo from '@/data/demo'
import type { Agent, Asset, Avatar, LiveSession, UsagePoint, User, Video, Voice, Workspace } from '@/types'

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

export const isDemoMode = !BASE

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
const clone = <T,>(v: T): T => structuredClone(v)

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} failed (${res.status})`)
  return res.json() as Promise<T>
}

export interface WorkspaceSnapshot {
  user: User
  workspace: Workspace
  avatars: Avatar[]
  voices: Voice[]
  videos: Video[]
  agents: Agent[]
  liveSessions: LiveSession[]
  assets: Asset[]
  usage: UsagePoint[]
}

export const api = {
  async loadWorkspace(): Promise<WorkspaceSnapshot> {
    if (isDemoMode) {
      await delay(450)
      return clone({
        user: demo.demoUser,
        workspace: demo.demoWorkspace,
        avatars: demo.demoAvatars,
        voices: demo.demoVoices,
        videos: demo.demoVideos,
        agents: demo.demoAgents,
        liveSessions: demo.demoLiveSessions,
        assets: demo.demoAssets,
        usage: demo.demoUsage,
      })
    }
    const [user, workspace, avatars, voices, videos, agents, liveSessions, assets, usage] = await Promise.all([
      request<User>('/me'),
      request<Workspace>('/workspace'),
      request<Avatar[]>('/avatars'),
      request<Voice[]>('/voices'),
      request<Video[]>('/videos'),
      request<Agent[]>('/agents'),
      request<LiveSession[]>('/live-sessions'),
      request<Asset[]>('/assets'),
      request<UsagePoint[]>('/analytics/usage'),
    ])
    return { user, workspace, avatars, voices, videos, agents, liveSessions, assets, usage }
  },

  /** Upload a reference video and begin avatar training. */
  async createAvatar(input: { name: string; file: File | null; consent: true }): Promise<Avatar> {
    if (isDemoMode) {
      await delay(300)
      return {
        id: `av_${Date.now().toString(36)}`,
        name: input.name,
        kind: 'Digital Twin',
        status: 'training',
        voiceId: 'v_studio',
        createdAt: new Date().toISOString(),
        hue: 200 + Math.round(Math.random() * 100),
        trainingProgress: 0,
        usage: { videos: 0, agents: 0, liveSessions: 0 },
        languages: ['English'],
      }
    }
    const body = new FormData()
    body.set('name', input.name)
    body.set('consent', 'true')
    if (input.file) body.set('reference', input.file)
    const res = await fetch(`${BASE}/avatars`, { method: 'POST', body, credentials: 'include' })
    if (!res.ok) throw new Error(`Avatar upload failed (${res.status})`)
    return res.json()
  },

  async generateVideo(input: Omit<Video, 'id' | 'status' | 'createdAt' | 'durationSec' | 'title'> & { title?: string }): Promise<Video> {
    if (isDemoMode) {
      await delay(250)
      return {
        ...input,
        id: `vid_${Date.now().toString(36)}`,
        title: input.title || input.prompt.split(/[.!?]/)[0].slice(0, 48) || 'Untitled video',
        status: 'generating',
        progress: 0,
        durationSec: 0,
        createdAt: new Date().toISOString(),
      }
    }
    return request<Video>('/videos', { method: 'POST', body: JSON.stringify(input) })
  },

  /** Re-queue a failed render with its original settings. Returns the patch to apply. */
  async retryVideo(id: string): Promise<Pick<Video, 'status' | 'progress'>> {
    if (isDemoMode) {
      await delay(250)
      return { status: 'generating', progress: 0 }
    }
    return request<Video>(`/videos/${id}/retry`, { method: 'POST' })
  },

  async saveAgent(agent: Agent): Promise<Agent> {
    if (isDemoMode) {
      await delay(250)
      return { ...agent, updatedAt: new Date().toISOString() }
    }
    return request<Agent>(`/agents/${agent.id}`, { method: 'PUT', body: JSON.stringify(agent) })
  },

  async createAgent(agent: Agent): Promise<Agent> {
    if (isDemoMode) {
      await delay(300)
      return agent
    }
    return request<Agent>('/agents', { method: 'POST', body: JSON.stringify(agent) })
  },

  async deleteAvatar(id: string): Promise<void> {
    if (isDemoMode) return void (await delay(300))
    await requestVoid(`/avatars/${id}`, { method: 'DELETE' })
  },

  async deleteAgent(id: string): Promise<void> {
    if (isDemoMode) return void (await delay(300))
    await requestVoid(`/agents/${id}`, { method: 'DELETE' })
  },

  /* ---------------------------------------------------------- Assets */
  async uploadAsset(file: File, kind: Asset['kind']): Promise<Asset> {
    if (isDemoMode) {
      await delay(300)
      return {
        id: `as_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        kind,
        sizeBytes: file.size,
        createdAt: new Date().toISOString(),
        durationSec: kind === 'video' || kind === 'audio' ? 30 : undefined,
        hue: kind === 'image' ? 200 + Math.round(Math.random() * 100) : undefined,
      }
    }
    const body = new FormData()
    body.set('file', file)
    body.set('kind', kind)
    const res = await fetch(`${BASE}/assets`, { method: 'POST', body, credentials: 'include' })
    if (!res.ok) throw new Error(`Asset upload failed (${res.status})`)
    return res.json()
  },

  async renameAsset(id: string, name: string): Promise<void> {
    if (isDemoMode) return void (await delay(250))
    await requestVoid(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
  },

  async deleteAsset(id: string): Promise<void> {
    if (isDemoMode) return void (await delay(300))
    await requestVoid(`/assets/${id}`, { method: 'DELETE' })
  },

  /** Returns a signed download URL (empty in demo mode). */
  async getAssetDownloadUrl(id: string): Promise<string> {
    if (isDemoMode) {
      await delay(200)
      return ''
    }
    return (await request<{ url: string }>(`/assets/${id}/download`)).url
  },

  /* ---------------------------------------------------------- Settings */
  async saveSettings(section: string, values: Record<string, unknown>): Promise<void> {
    if (isDemoMode) return void (await delay(350))
    await requestVoid(`/settings/${section}`, { method: 'PUT', body: JSON.stringify(values) })
  },

  async listApiKeys(): Promise<ApiKey[]> {
    if (isDemoMode) {
      await delay(200)
      return clone(demoApiKeys)
    }
    return request<ApiKey[]>('/api-keys')
  },

  /** Creates a key; the full secret is only returned once. */
  async createApiKey(input: { name: string; scope: ApiKey['scope'] }): Promise<{ key: ApiKey; secret: string }> {
    if (isDemoMode) {
      await delay(400)
      const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
      const rand = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => alphabet[b % alphabet.length]).join('')
      const secret = `pk_demo_${rand}`
      return {
        secret,
        key: { id: `key_${Date.now().toString(36)}`, name: input.name, scope: input.scope, prefix: 'pk_demo', last4: rand.slice(-4), createdAt: new Date().toISOString() },
      }
    }
    return request('/api-keys', { method: 'POST', body: JSON.stringify(input) })
  },

  async revokeApiKey(id: string): Promise<void> {
    if (isDemoMode) return void (await delay(300))
    await requestVoid(`/api-keys/${id}`, { method: 'DELETE' })
  },

  async listTeam(): Promise<TeamMember[]> {
    if (isDemoMode) {
      await delay(200)
      return clone(demoTeam)
    }
    return request<TeamMember[]>('/team')
  },

  async inviteMember(input: { email: string; role: TeamRole }): Promise<TeamMember> {
    if (isDemoMode) {
      await delay(400)
      return { id: `tm_${Date.now().toString(36)}`, name: input.email.split('@')[0], email: input.email, role: input.role, status: 'invited' }
    }
    return request<TeamMember>('/team/invites', { method: 'POST', body: JSON.stringify(input) })
  },

  async updateMemberRole(id: string, role: TeamRole): Promise<void> {
    if (isDemoMode) return void (await delay(250))
    await requestVoid(`/team/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) })
  },

  async listSessions(): Promise<AuthSession[]> {
    if (isDemoMode) {
      await delay(200)
      return clone(demoSessions)
    }
    return request<AuthSession[]>('/security/sessions')
  },

  async revokeSession(id: string): Promise<void> {
    if (isDemoMode) return void (await delay(300))
    await requestVoid(`/security/sessions/${id}`, { method: 'DELETE' })
  },

  async changePassword(input: { current: string; next: string }): Promise<void> {
    if (isDemoMode) return void (await delay(500))
    await requestVoid('/security/password', { method: 'POST', body: JSON.stringify(input) })
  },
}

/* For endpoints that return no body (204). */
async function requestVoid(path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} failed (${res.status})`)
}

/* ---------------------------------------------------------- Settings types + demo rows */
export interface ApiKey {
  id: string
  name: string
  scope: 'full' | 'read' | 'videos' | 'agents'
  prefix: string
  last4: string
  createdAt: string
  lastUsedAt?: string
}

export type TeamRole = 'Owner' | 'Admin' | 'Editor' | 'Recruiter' | 'Viewer'
export interface TeamMember {
  id: string
  name: string
  email: string
  role: TeamRole
  status: 'active' | 'invited'
}

export interface AuthSession {
  id: string
  device: string
  location: string
  lastActiveAt: string
  current?: boolean
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

const demoApiKeys: ApiKey[] = [
  { id: 'key_1', name: 'Production — website widget', scope: 'agents', prefix: 'pk_live', last4: '3f9a', createdAt: hoursAgo(24 * 34), lastUsedAt: hoursAgo(1) },
  { id: 'key_2', name: 'Video pipeline', scope: 'videos', prefix: 'pk_live', last4: '81c2', createdAt: hoursAgo(24 * 12), lastUsedAt: hoursAgo(26) },
  { id: 'key_3', name: 'Analytics export', scope: 'read', prefix: 'pk_live', last4: 'd07e', createdAt: hoursAgo(24 * 5) },
]

const demoTeam: TeamMember[] = [
  { id: 'tm_1', name: 'Shalya Kumar', email: 'shalya@rooman.com', role: 'Owner', status: 'active' },
  { id: 'tm_2', name: 'Priya Nair', email: 'priya@rooman.com', role: 'Recruiter', status: 'active' },
  { id: 'tm_3', name: 'Arjun Mehta', email: 'arjun@rooman.com', role: 'Viewer', status: 'active' },
  { id: 'tm_4', name: 'Meera Iyer', email: 'meera@rooman.com', role: 'Editor', status: 'active' },
]

const demoSessions: AuthSession[] = [
  { id: 'ss_1', device: 'Chrome on Windows', location: 'Bengaluru, IN', lastActiveAt: new Date().toISOString(), current: true },
  { id: 'ss_2', device: 'Safari on iPhone', location: 'Bengaluru, IN', lastActiveAt: hoursAgo(5) },
  { id: 'ss_3', device: 'Firefox on macOS', location: 'Mumbai, IN', lastActiveAt: hoursAgo(24 * 3) },
]
