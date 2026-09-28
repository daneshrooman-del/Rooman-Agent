/* Shared options + helpers for the video studio (Create Video + Library). */
import { Footprints, Hand, MessageSquareText, Presentation, Smile, type LucideIcon } from 'lucide-react'
import type { ActionType, AspectRatio, Scene, Video } from '@/types'

export const LANGUAGES = ['English', 'Hindi', 'Kannada', 'Spanish', 'Tamil', 'French', 'German', 'Arabic']

export const ACTIONS: { value: ActionType; label: string; icon: LucideIcon }[] = [
  { value: 'talk', label: 'Talk', icon: MessageSquareText },
  { value: 'gesture', label: 'Gesture', icon: Hand },
  { value: 'greeting', label: 'Greeting', icon: Smile },
  { value: 'walk', label: 'Walk', icon: Footprints },
  { value: 'demonstrate', label: 'Demonstrate', icon: Presentation },
]

export const SCENES: { value: Scene; label: string; description: string }[] = [
  { value: 'studio', label: 'Studio', description: 'Soft key light, seamless backdrop' },
  { value: 'office', label: 'Office', description: 'Modern workspace, window light' },
  { value: 'custom', label: 'Custom', description: 'Upload your own background' },
]

export const ASPECTS: { value: AspectRatio; label: string; hint: string }[] = [
  { value: '16:9', label: '16:9', hint: 'Landscape' },
  { value: '9:16', label: '9:16', hint: 'Vertical' },
  { value: '1:1', label: '1:1', hint: 'Square' },
]

export const ASPECT_VALUE: Record<AspectRatio, number> = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1 }

export const EXAMPLE_PROMPTS = [
  'Introduce our company.',
  'Walk toward the camera and explain the product.',
  'Welcome new customers.',
]

export const GENERATION_STAGES = [
  'Preparing your avatar',
  'Generating motion',
  'Rendering video',
  'Checking identity consistency',
  'Finalizing video',
]

export const PROMPT_MIN = 10
export const PROMPT_MAX = 1200

export const sceneLabel = (s: Scene) => SCENES.find((x) => x.value === s)?.label ?? s
export const actionLabel = (a: ActionType) => ACTIONS.find((x) => x.value === a)?.label ?? a

/** Rough runtime estimate from the brief: short prompts still make a ~15s clip. */
export function estimateDuration(prompt: string, action: ActionType) {
  const words = prompt.trim().split(/\s+/).filter(Boolean).length
  const base = action === 'walk' || action === 'demonstrate' ? 18 : 12
  return Math.min(180, Math.max(15, Math.round(base + words * 1.8)))
}

/** 1 credit per 6 seconds of rendered video. */
export const creditCost = (sec: number) => Math.max(1, Math.ceil(sec / 6))

/** Settings a video can be (re)created from — passed via router state to /create. */
export interface VideoDraft {
  prompt?: string
  action?: ActionType
  scene?: Scene
  aspect?: AspectRatio
  voiceId?: string
  language?: string
}

export const draftFromVideo = (v: Video): VideoDraft => ({
  prompt: v.prompt,
  action: v.action,
  scene: v.scene,
  aspect: v.aspect,
  voiceId: v.voiceId,
  language: v.language,
})

export const videoShareUrl = (id: string) => `${window.location.origin}/videos?v=${id}`
