/* ------------------------------------------------------------------
   Client for the Track A avatar engine (avatar-engine/, `avatar-engine serve`).

   Enabled by VITE_AVATAR_ENGINE_URL (e.g. http://127.0.0.1:8100). When set,
   creating an avatar trains a real digital twin from the uploaded video and
   Create Video renders real talking videos of it. Everything else in the app
   keeps using src/lib/api.ts as before.
   ------------------------------------------------------------------ */
import type { ActionType, Avatar, Video } from '@/types'

export const ENGINE_URL = (import.meta.env.VITE_AVATAR_ENGINE_URL as string | undefined)?.replace(/\/$/, '')
export const engineEnabled = !!ENGINE_URL

const LANGUAGE_CODES: Record<string, string> = {
  English: 'en', Hindi: 'hi', Spanish: 'es', French: 'fr', German: 'de', Arabic: 'ar', Portuguese: 'pt', Italian: 'it', Japanese: 'ja', Korean: 'ko',
}

/** UI actions → engine action types. Engine supports talk + greet today. */
const ACTION_MAP: Partial<Record<ActionType, string>> = { talk: 'talk', greeting: 'greet' }

export const engineSupports = (action: ActionType) => action in ACTION_MAP
export const engineSupportsLanguage = (language: string) => language in LANGUAGE_CODES

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${ENGINE_URL}${path}`, init)
  } catch {
    throw new Error('The avatar engine is not reachable. Start it with `avatar-engine serve`.')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const detail = body?.detail
    throw new Error(typeof detail === 'string' ? detail : (detail?.error ?? `Avatar engine error (${res.status})`))
  }
  return res.json() as Promise<T>
}

interface Manifest {
  avatar_id: string
  status: 'training' | 'ready' | 'failed'
  stage: number
  stages: string[]
  message?: string
  error?: string
  warnings?: string[]
  provider?: 'tavus' | 'local'
  /** 0–100 within the current stage (Tavus face training) */
  training_progress?: number
}

export interface EngineJob {
  job_id: string
  status: 'queued' | 'running' | 'done' | 'failed' | 'rejected'
  stage: number
  stages: string[]
  message?: string
  error?: string
  duration_sec?: number
  consistency?: { verdict: 'verified' | 'flagged' | 'rejected'; match_ratio: number; reason: string }
}

export const engine = {
  async createAvatar(name: string, file: File): Promise<Avatar> {
    const body = new FormData()
    body.set('video', file)
    body.set('consent', 'true')
    body.set('name', name)
    const r = await call<{ avatar_id: string }>('/avatars', { method: 'POST', body })
    return {
      id: r.avatar_id,
      name,
      kind: 'Digital Twin',
      status: 'training',
      voiceId: `voice_${r.avatar_id}`,
      createdAt: new Date().toISOString(),
      hue: 200 + Math.round(Math.random() * 100),
      trainingProgress: 0,
      usage: { videos: 0, agents: 0, liveSessions: 0 },
      languages: ['English', 'Hindi'],
      engine: true,
    }
  },

  /** Training state mapped onto the UI's avatar fields. */
  async avatarStatus(
    id: string,
  ): Promise<Pick<Avatar, 'status' | 'trainingProgress' | 'thumbnailUrl'> & { stage: number; stages: string[]; message?: string; warnings: string[]; error?: string }> {
    const m = await call<Manifest>(`/avatars/${id}`)
    const total = m.stages.length || 5
    const status = m.status === 'ready' ? 'ready' : m.status === 'failed' ? 'failed' : 'training'
    const within = (m.training_progress ?? 0) / 100 / total
    return {
      status,
      stage: Math.min(m.stage, total - 1),
      stages: m.stages,
      message: m.message,
      warnings: m.warnings ?? [],
      trainingProgress: status === 'ready' ? 100 : Math.min(99, Math.round((m.stage / total + within) * 100)),
      thumbnailUrl: m.stage >= 2 || status === 'ready' ? `${ENGINE_URL}/avatars/${id}/reference` : undefined,
      error: m.error,
    }
  },

  async generate(avatarId: string, input: { script: string; action: ActionType; language: string }): Promise<EngineJob> {
    const body = new FormData()
    body.set('action_type', ACTION_MAP[input.action] ?? input.action)
    body.set('language', LANGUAGE_CODES[input.language] ?? 'en')
    body.set('script', input.script)
    return call<EngineJob>(`/avatars/${avatarId}/generate`, { method: 'POST', body })
  },

  job: (jobId: string) => call<EngineJob>(`/jobs/${jobId}`),

  /** UI video fields for a job snapshot. */
  videoPatch(job: EngineJob): Partial<Video> {
    const total = job.stages.length || 5
    if (job.status === 'done') {
      return { status: 'ready', progress: 100, url: `${ENGINE_URL}/jobs/${job.job_id}/video`, durationSec: Math.round(job.duration_sec ?? 0), consistencyVerified: job.consistency?.verdict === 'verified' }
    }
    if (job.status === 'failed' || job.status === 'rejected') return { status: 'failed' }
    return { status: 'generating', progress: Math.round((job.stage / total) * 100) }
  },
}
