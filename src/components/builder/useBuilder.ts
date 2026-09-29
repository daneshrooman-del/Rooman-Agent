import { useCallback, useEffect, useRef, useState } from 'react'
import { api, isDemoMode } from '@/lib/api'
import { buildConfig, refineConfig, templateCopy, transcriptText, type BuilderConfig, type FromLive, type SectionKey } from './templates'

export const STAGES = ['Understand', 'Plan', 'Knowledge', 'Avatar', 'Tools', 'Deploy'] as const

export interface BuilderMessage {
  id: string
  role: 'user' | 'builder'
  /** 'step' = compact progress line from the builder */
  variant?: 'message' | 'step' | 'ready' | 'live'
  text: string
  plan?: string[]
  /** stream the text in on first render */
  stream?: boolean
}

export type BuildState = 'idle' | 'running' | 'done'

/** Order in which configuration sections are revealed, paired with the stage that reveals them. */
const REVEAL: { at: number; stage: number; sections: SectionKey[]; step?: (c: BuilderConfig, names: { avatar: string; voice: string }) => string }[] = [
  { at: 1700, stage: 1, sections: ['purpose', 'caller'] },
  { at: 2600, stage: 1, sections: ['goals'] },
  { at: 3400, stage: 1, sections: ['workflow'], step: (c) => `Mapped a ${c.workflow.length}-step conversation flow` },
  { at: 4500, stage: 2, sections: ['knowledge'], step: (c) => `Suggested ${c.knowledge.length} knowledge sources` },
  { at: 5700, stage: 3, sections: ['avatar', 'voice'], step: (_c, n) => `Paired with ${n.avatar} and ${n.voice}` },
  { at: 6900, stage: 4, sections: ['tools', 'guardrails'], step: (c) => `Enabled ${c.tools.filter((t) => t.enabled).length} tools and ${c.guardrails.length} guardrails` },
  { at: 8100, stage: 5, sections: ['languages', 'channels'], step: (c) => `Prepared ${c.channels.length} deployment channel${c.channels.length > 1 ? 's' : ''}` },
]
const DONE_AT = 9400

let seq = 0
const mid = () => `m${++seq}_${Date.now().toString(36)}`

export function useBuilder({
  avatar,
  names,
  fromLive,
  initialPrompt,
  owner,
}: {
  avatar: { id: string; voiceId: string }
  names: (cfg: BuilderConfig) => { avatar: string; voice: string }
  fromLive?: FromLive & { avatarName?: string }
  initialPrompt?: string
  /** identifies who is building this agent — used to open a backend intake session */
  owner?: string
}) {
  const makeConfig = (text: string) => {
    const source = fromLive ? `${text} ${transcriptText(fromLive.transcript)} ${(fromLive.goals ?? []).join(' ')}` : text
    const cfg = buildConfig(source, avatar)
    if (!fromLive) return cfg
    return {
      ...cfg,
      personality: fromLive.personality || cfg.personality,
      goals: fromLive.goals?.length ? Array.from(new Set([...fromLive.goals, ...cfg.goals])).slice(0, 6) : cfg.goals,
    }
  }

  const [messages, setMessages] = useState<BuilderMessage[]>(() => {
    const seed: BuilderMessage[] = []
    if (fromLive) {
      seed.push({
        id: mid(),
        role: 'builder',
        variant: 'live',
        stream: true,
        text: `I've pulled in your live conversation with ${fromLive.avatarName ?? 'your avatar'}. I'll keep the personality and goals you rehearsed. Tell me anything to add, or build it as is.`,
        plan: [...(fromLive.personality ? [`Personality: ${fromLive.personality}`] : []), ...(fromLive.goals ?? []).slice(0, 3).map((g) => `Goal: ${g}`)],
      })
    }
    if (initialPrompt) seed.push({ id: mid(), role: 'user', text: initialPrompt })
    return seed
  })
  /** The running build. Its timeline is scheduled by an effect so it survives StrictMode re-mounts. */
  const [job, setJob] = useState<{ cfg: BuilderConfig; startedAt: number } | null>(() =>
    initialPrompt ? { cfg: makeConfig(initialPrompt), startedAt: Date.now() } : null,
  )
  const [config, setConfig] = useState<BuilderConfig | null>(null)
  const [state, setState] = useState<BuildState>(initialPrompt ? 'running' : 'idle')
  const [stage, setStage] = useState(initialPrompt ? 0 : -1)
  const [revealed, setRevealed] = useState<Set<SectionKey>>(() => new Set())
  const [typing, setTyping] = useState(!!initialPrompt)
  const [flash, setFlash] = useState<{ keys: SectionKey[]; n: number }>({ keys: [], n: 0 })
  /** The backend intake session for this build, once a real API is configured. Not consumed
   *  anywhere yet (the builder's chat stays fully local/scripted) but ready for the future —
   *  e.g. attaching reference documents via `api.uploadReferenceDocument(sessionId, file)`. */
  const [sessionId, setSessionId] = useState<string | null>(null)
  const timers = useRef<number[]>([])
  const namesRef = useRef(names)
  const ownerRef = useRef(owner)
  useEffect(() => {
    ownerRef.current = owner
  })

  const startIntake = useCallback(() => {
    if (isDemoMode) return
    api
      .startIntakeSession(ownerRef.current ?? 'unknown')
      .then((s) => setSessionId(s.session_id))
      .catch((err) => console.error('Failed to start the intake session', err))
  }, [])

  useEffect(() => {
    if (initialPrompt) startIntake()
    // fire once on mount only, matching the initial `job` seeded below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    namesRef.current = names
  })

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
  const push = (m: Omit<BuilderMessage, 'id'>) => setMessages((l) => [...l, { ...m, id: mid() }])

  useEffect(() => {
    if (!job) return
    const { cfg, startedAt } = job
    const local: number[] = []
    const at = (ms: number, fn: () => void) => local.push(window.setTimeout(fn, Math.max(0, ms - (Date.now() - startedAt))))
    const copy = templateCopy(cfg.kind, cfg.name)
    at(900, () => {
      setTyping(false)
      setConfig(cfg)
      push({ role: 'builder', text: copy.ack, plan: copy.plan, stream: true })
    })
    REVEAL.forEach((r) =>
      at(r.at, () => {
        setStage(r.stage)
        setRevealed((s) => new Set([...s, ...r.sections]))
        if (r.step) push({ role: 'builder', variant: 'step', text: r.step(cfg, namesRef.current(cfg)) })
      }),
    )
    at(DONE_AT, () => {
      setStage(STAGES.length)
      setState('done')
      push({
        role: 'builder',
        variant: 'ready',
        stream: true,
        text: `Your agent is ready. Test it, deploy it, or keep refining — try “Also make it speak Hindi” or “Add a calendar tool”.`,
      })
    })
    return () => local.forEach((t) => window.clearTimeout(t))
  }, [job])

  const build = useCallback(
    (text: string) => {
      if (text.trim()) push({ role: 'user', text: text.trim() })
      setState('running')
      setStage(0)
      setTyping(true)
      setJob({ cfg: makeConfig(text), startedAt: Date.now() })
      startIntake()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [avatar.id, avatar.voiceId, fromLive, startIntake],
  )

  const refine = useCallback(
    (text: string) => {
      if (!config) return
      push({ role: 'user', text: text.trim() })
      setTyping(true)
      const r = refineConfig(config, text)
      later(750, () => {
        setTyping(false)
        setConfig(r.config)
        setFlash((f) => ({ keys: r.changed, n: f.n + 1 }))
        push({ role: 'builder', text: r.reply, stream: true })
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config],
  )

  const send = useCallback(
    (text: string) => {
      if (!text.trim() || state === 'running' || typing) return
      if (state === 'idle') build(text)
      else refine(text)
    },
    [state, typing, build, refine],
  )

  const markStreamed = useCallback((id: string) => setMessages((l) => l.map((m) => (m.id === id ? { ...m, stream: false } : m))), [])

  const update = useCallback((patch: Partial<BuilderConfig>, keys: SectionKey[]) => {
    setConfig((c) => (c ? { ...c, ...patch } : c))
    setFlash((f) => ({ keys, n: f.n + 1 }))
  }, [])

  return { messages, config, state, stage, revealed, typing, flash, sessionId, send, build, update, markStreamed }
}
