import { useCallback, useEffect, useRef, useState } from 'react'
import { useOnline } from '@/hooks/useOnline'
import type { ConnectionStatus, LiveEvent, Responder, ResponderMeta, TranscriptItem, TurnPhase } from './types'

/* ------------------------------------------------------------------
   useLiveConversation — SIMULATED live conversation engine.

   Everything here is scripted: "connecting", the user's "voice", the
   mic level, and the avatar's replies (produced by the `responder`
   you pass in). It exists so the Live AI and Agent Live Test screens
   behave realistically in demo mode.

   Realtime integration point: to go live, replace the internals of
   `connect` / `send` / `speak` / `end` with a WebRTC (media + data
   channel) or WebSocket session to the avatar backend, and feed its
   messages into the same state:
     • connection events  → setStatus('connecting' | 'online' | …)
     • VAD / mic RMS       → setMicLevel(0..1), setPhase('listening')
     • ASR final text      → pushMessage('user', text)
     • agent step events   → pushEvent({ kind, detail })
     • TTS text deltas     → append to the streaming avatar message
   The returned API and the TranscriptItem shape stay the same, so the
   UI components (LiveStage, Transcript, ControlBar) need no changes.
   ------------------------------------------------------------------ */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

interface Options {
  responder: Responder
  /** what the avatar says as soon as the session is online */
  greeting?: string
  /** utterances used when the user presses "speak" without a prompt */
  voicePrompts?: string[]
  /** connect immediately on mount (Agent Live Test); the Live page waits for "Start" */
  autoConnect?: boolean
  /** milliseconds between streamed words */
  wordMs?: number
}

export function useLiveConversation({ responder, greeting, voicePrompts = [], autoConnect = false, wordMs = 55 }: Options) {
  const online = useOnline()
  const [rawStatus, setStatus] = useState<ConnectionStatus>('idle')
  const [phase, setPhase] = useState<TurnPhase>('idle')
  const [items, setItems] = useState<TranscriptItem[]>([])
  const [micLevel, setMicLevel] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [endedAt, setEndedAt] = useState<number | null>(null)

  const timers = useRef(new Set<number>())
  const seq = useRef(0)
  const turn = useRef(0)
  const responderRef = useRef(responder)
  const greetingRef = useRef(greeting)
  const streamingId = useRef<string | null>(null)
  const streamingFull = useRef('')
  useEffect(() => {
    responderRef.current = responder
    greetingRef.current = greeting
  })

  const later = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(() => {
      timers.current.delete(t)
      fn()
    }, ms)
    timers.current.add(t)
  }, [])
  const every = useCallback((fn: () => void, ms: number) => {
    const t = window.setInterval(fn, ms)
    timers.current.add(t)
    return () => {
      window.clearInterval(t)
      timers.current.delete(t)
    }
  }, [])
  const clearAll = useCallback(() => {
    timers.current.forEach((t) => {
      window.clearTimeout(t)
      window.clearInterval(t)
    })
    timers.current.clear()
  }, [])
  useEffect(() => clearAll, [clearAll])

  const nextId = () => `li_${++seq.current}`

  /** Finish any in-flight streamed reply immediately (barge-in / end). */
  const finalizeStreaming = useCallback(() => {
    const id = streamingId.current
    if (!id) return
    const full = streamingFull.current
    setItems((l) => l.map((it) => (it.id === id && it.type === 'message' ? { ...it, text: full, streaming: false } : it)))
    streamingId.current = null
  }, [])

  const pushMessage = useCallback((speaker: 'user' | 'avatar', text: string) => {
    setItems((l) => [...l, { id: nextId(), type: 'message', speaker, text, at: Date.now() }])
  }, [])

  const pushEvent = useCallback((e: LiveEvent) => {
    setItems((l) => [...l, { id: nextId(), type: 'event', at: Date.now(), ...e }])
  }, [])

  /** Stream an avatar message word-by-word. */
  const streamReply = useCallback(
    (text: string) => {
      const id = nextId()
      const words = text.split(/(\s+)/).filter(Boolean)
      streamingId.current = id
      streamingFull.current = text
      setPhase('speaking')
      const reduced = prefersReducedMotion()
      setItems((l) => [...l, { id, type: 'message', speaker: 'avatar', text: reduced ? text : '', streaming: !reduced, at: Date.now() }])
      const done = () => {
        if (streamingId.current === id) streamingId.current = null
        setItems((l) => l.map((it) => (it.id === id && it.type === 'message' ? { ...it, text, streaming: false } : it)))
        setPhase('idle')
      }
      if (reduced) {
        later(done, Math.min(2400, 300 + words.length * 30))
        return
      }
      let i = 0
      const stop = every(() => {
        i += 2 // a word + its following whitespace
        const partial = words.slice(0, i).join('')
        setItems((l) => l.map((it) => (it.id === id && it.type === 'message' ? { ...it, text: partial } : it)))
        if (i >= words.length) {
          stop()
          done()
        }
      }, wordMs)
    },
    [every, later, wordMs],
  )

  /** Run the responder: think, emit step events one by one, then speak. */
  const respond = useCallback(
    (input: string, meta: Omit<ResponderMeta, 'turn'>) => {
      turn.current += 1
      const reply = responderRef.current(input, { ...meta, turn: turn.current })
      setPhase('thinking')
      const events = reply.events ?? []
      let at = 420
      events.forEach((e) => {
        later(() => pushEvent(e), at)
        at += 520
      })
      later(() => streamReply(reply.text), at + 120)
    },
    [later, pushEvent, streamReply],
  )

  const status: ConnectionStatus =
    !online && (rawStatus === 'online' || rawStatus === 'connecting' || rawStatus === 'reconnecting') ? 'offline' : rawStatus

  // Coming back online mid-session → brief "reconnecting" before resuming.
  const wasOnline = useRef(online)
  useEffect(() => {
    if (online && !wasOnline.current && rawStatus === 'online') {
      setStatus('reconnecting')
      later(() => setStatus((s) => (s === 'reconnecting' ? 'online' : s)), 1600)
    }
    if (!online) {
      clearAll()
      finalizeStreaming()
      setPhase('idle')
      setMicLevel(0)
    }
    wasOnline.current = online
  }, [online, rawStatus, later, clearAll, finalizeStreaming])

  const connect = useCallback(() => {
    clearAll()
    setItems([])
    turn.current = 0
    setPhase('idle')
    setEndedAt(null)
    setStatus('connecting')
    later(() => {
      setStatus('online')
      setStartedAt(Date.now())
      if (greetingRef.current) later(() => streamReply(greetingRef.current!), 350)
    }, 1100)
  }, [clearAll, later, streamReply])

  const canTalk = status === 'online'

  const send = useCallback(
    (text: string, meta: { scenario?: string } = {}) => {
      const t = text.trim()
      if (!t || !canTalk) return false
      clearAll()
      finalizeStreaming()
      setMicLevel(0)
      pushMessage('user', t)
      respond(t, { ...meta, spoken: false })
      return true
    },
    [canTalk, clearAll, finalizeStreaming, pushMessage, respond],
  )

  /** Simulate the user speaking: listening + mic level, then a transcribed utterance. */
  const speak = useCallback(
    (prompt?: string, meta: { scenario?: string } = {}) => {
      if (!canTalk) return false
      const text = prompt ?? voicePrompts[turn.current % Math.max(1, voicePrompts.length)] ?? 'Hello, can you hear me?'
      clearAll()
      finalizeStreaming()
      setPhase('listening')
      const reduced = prefersReducedMotion()
      setMicLevel(0.6)
      const stop = reduced ? () => {} : every(() => setMicLevel(0.25 + Math.random() * 0.75), 130)
      later(() => {
        stop()
        setMicLevel(0)
        pushMessage('user', text)
        respond(text, { ...meta, spoken: true })
      }, 1900)
      return true
    },
    [canTalk, clearAll, every, finalizeStreaming, later, pushMessage, respond, voicePrompts],
  )

  const end = useCallback(() => {
    clearAll()
    finalizeStreaming()
    setPhase('idle')
    setMicLevel(0)
    setStatus('ended')
    setEndedAt(Date.now())
  }, [clearAll, finalizeStreaming])

  const reset = useCallback(() => {
    clearAll()
    streamingId.current = null
    setItems([])
    setPhase('idle')
    setMicLevel(0)
    setStatus('idle')
    setStartedAt(null)
    setEndedAt(null)
    turn.current = 0
  }, [clearAll])

  useEffect(() => {
    if (autoConnect) connect()
    // connect once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const messageCount = items.filter((i) => i.type === 'message').length

  return { status, phase, items, micLevel, messageCount, startedAt, endedAt, canTalk, connect, send, speak, end, reset }
}

export type LiveConversation = ReturnType<typeof useLiveConversation>
