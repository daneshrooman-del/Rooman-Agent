/* Domain model. The Avatar is the core identity layer every other
   experience (videos, live sessions, agents) references by id. */

export type AvatarStatus = 'ready' | 'training' | 'failed' | 'draft'
export type VideoStatus = 'ready' | 'generating' | 'failed' | 'queued'
export type AgentStatus = 'live' | 'paused' | 'draft' | 'deploying'
export type AssetKind = 'video' | 'audio' | 'avatar' | 'document' | 'image'
export type KnowledgeStatus = 'ready' | 'processing' | 'failed' | 'queued'
export type Channel = 'phone' | 'web' | 'api' | 'video' | 'whatsapp'
export type AspectRatio = '16:9' | '9:16' | '1:1'
export type ActionType = 'talk' | 'gesture' | 'greeting' | 'walk' | 'demonstrate'
export type Scene = 'studio' | 'office' | 'custom'

export interface Voice {
  id: string
  name: string
  avatarId?: string
  kind: 'cloned' | 'stock'
  language: string
  tone: string
}

export interface Avatar {
  id: string
  name: string
  kind: string // e.g. "Digital Twin"
  status: AvatarStatus
  voiceId: string
  createdAt: string
  /** 0–360 — tints the avatar's generated visual identity */
  hue: number
  /** optional real media from the backend */
  thumbnailUrl?: string
  previewVideoUrl?: string
  trainingProgress?: number
  primary?: boolean
  usage: { videos: number; agents: number; liveSessions: number }
  languages: string[]
  /** true when this avatar is a real digital twin trained by the avatar engine */
  engine?: boolean
}

export interface Video {
  id: string
  title: string
  avatarId: string
  voiceId: string
  prompt: string
  action: ActionType
  scene: Scene
  aspect: AspectRatio
  language: string
  durationSec: number
  status: VideoStatus
  progress?: number
  createdAt: string
  url?: string
  consistencyVerified?: boolean
}

export interface LiveSession {
  id: string
  avatarId: string
  agentId?: string
  title: string
  durationSec: number
  messages: number
  createdAt: string
}

export interface AgentStats {
  conversations: number
  completionRate: number
  activeToday: number
  avgDurationSec: number
}

export interface WorkflowNode {
  id: string
  label: string
  kind: 'start' | 'step' | 'decision' | 'tool' | 'end' | 'handoff'
  description?: string
}

export interface KnowledgeSource {
  id: string
  name: string
  type: 'pdf' | 'docx' | 'pptx' | 'txt' | 'csv' | 'xlsx' | 'url'
  sizeBytes: number
  status: KnowledgeStatus
  chunks: number
  updatedAt: string
  progress?: number
}

export interface AgentTool {
  id: string
  name: string
  description: string
  enabled: boolean
}

export interface Agent {
  id: string
  name: string
  status: AgentStatus
  avatarId: string
  voiceId: string
  purpose: string
  caller: string
  goals: string[]
  personality: string
  guardrails: string[]
  languages: string[]
  channels: Channel[]
  tools: AgentTool[]
  knowledge: KnowledgeSource[]
  workflow: WorkflowNode[]
  stats: AgentStats
  createdAt: string
  updatedAt: string
  activity: { id: string; text: string; at: string; kind: 'conversation' | 'deploy' | 'edit' | 'handoff' }[]
}

export interface Asset {
  id: string
  name: string
  kind: AssetKind
  sizeBytes: number
  createdAt: string
  avatarId?: string
  durationSec?: number
  hue?: number
}

export interface UsagePoint {
  label: string
  videos: number
  liveMinutes: number
  agentConversations: number
}

export interface Workspace {
  id: string
  name: string
  plan: string
  credits: { used: number; total: number }
  storage: { usedBytes: number; totalBytes: number }
}

export interface User {
  id: string
  name: string
  email: string
  role: string
}
