import { useCallback, useEffect, useRef, useState } from 'react'
import { ConnectionState, createAudioAnalyser, Room, RoomEvent, Track, type LocalAudioTrack } from 'livekit-client'
import { useOnline } from '@/hooks/useOnline'
import { isDemoMode, type LiveSessionHandle } from '@/lib/api'
import type { ConnectionStatus, LiveEvent, Responder, ResponderMeta, Speaker, TranscriptItem, TurnPhase } from './types'

/* ------------------------------------------------------------------
   useLiveConversation — live conversation engine.

   In demo mode (no VITE_API_URL) everything is scripted: "connecting",
   the user's "voice", the mic level, and the avatar's replies (produced
   by the `responder` you pass in). That path is untouched below.

   When a real backend is configured, `connect()` calls the `startSession`
   option to get LiveKit room credentials, joins the room with
   livekit-client, publishes the microphone, plays the remote (agent)
   audio track, and turns `RoomEvent.TranscriptionReceived` segments into
   the same TranscriptItem messages the simulated path produces — so the
   UI components (LiveStage, Transcript, ControlBar) need no changes.
   ------------------------------------------------------------------ */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

interface Options {
  responder: Responder
  /** what the avatar says as soon as the session is online (demo mode only — a real agent greets on its own) */
  greeting?: string
  /** utterances used when the user presses "speak" without a prompt (demo mode only) */
  voicePrompts?: string[]
  /** connect immediately on mount (Agent Live Test); the Live page waits for "Start" */
  autoConnect?: boolean
  /** milliseconds between streamed words (demo mode only) */
  wordMs?: number
  /**
   * Starts a real backend session and returns LiveKit room credentials.
   * Required to go live when a real API is configured (`!isDemoMode`); the
   * caller picks the right backend endpoint (a new intake session vs. a
   * conversation with an already-deployed agent). Ignored in demo mode.
   */
  startSession?: () => Promise<LiveSessionHandle>
}

export function useLiveConversation({ responder, greeting, voicePrompts = [], autoConnect = false, wordMs = 55, startSession }: Options) {
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
  const startSessionRef = useRef(startSession)
  const streamingId = useRef<string | null>(null)
  const streamingFull = useRef('')

  // Real (LiveKit) session plumbing.
  const roomRef = useRef<Room | null>(null)
  const audioElsRef = useRef<Map<string, HTMLMediaElement>>(new Map())
  const micMeterCleanupRef = useRef<(() => void) | null>(null)
  const segmentItemIds = useRef(new Map<string, string>())

  useEffect(() => {
    responderRef.current = responder
    greetingRef.current = greeting
    startSessionRef.current = startSession
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

  /** Tear down the real LiveKit room and everything attached to it. */
  const teardownRoom = useCallback(() => {
    micMeterCleanupRef.current?.()
    micMeterCleanupRef.current = null
    segmentItemIds.current.clear()
    audioElsRef.current.forEach((el) => {
      el.pause()
      el.srcObject = null
      el.remove()
    })
    audioElsRef.current.clear()
    const room = roomRef.current
    roomRef.current = null
    if (room) {
      room.removeAllListeners()
      room.disconnect().catch(() => {})
    }
  }, [])

  useEffect(
    () => () => {
      clearAll()
      teardownRoom()
    },
    [clearAll, teardownRoom],
  )

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

  /** Real mode: create/update the TranscriptItem for a (possibly still-interim) transcription segment. */
  const upsertSegment = useCallback((speaker: Speaker, seg: { id: string; text: string; final: boolean }) => {
    const existing = segmentItemIds.current.get(seg.id)
    if (existing) {
      setItems((l) => l.map((it) => (it.id === existing && it.type === 'message' ? { ...it, text: seg.text, streaming: !seg.final } : it)))
    } else {
      const id = nextId()
      segmentItemIds.current.set(seg.id, id)
      setItems((l) => [...l, { id, type: 'message', speaker, text: seg.text, streaming: !seg.final, at: Date.now() }])
    }
    if (seg.final) {
      segmentItemIds.current.delete(seg.id)
      setPhase(speaker === 'user' ? 'thinking' : 'idle')
    } else {
      setPhase(speaker === 'user' ? 'listening' : 'speaking')
    }
  }, [])

  /** Stream an avatar message word-by-word (demo mode). */
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

  /** Run the responder: think, emit step events one by one, then speak (demo mode). */
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

  /** Join the real LiveKit room returned by `startSession` and wire it into this hook's state. */
  const connectReal = useCallback(() => {
    setStatus('connecting')
    ;(async () => {
      try {
        const start = startSessionRef.current
        if (!start) throw new Error('No live session starter was provided.')
        const session = await start()
        const room = new Room()
        roomRef.current = room

        room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
          // The browser's own local participant is the human caller; anything
          // else (the backend agent's participant) is the avatar speaking.
          const speaker: Speaker = participant?.isLocal ? 'user' : 'avatar'
          segments.forEach((seg) => upsertSegment(speaker, seg))
        })

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach()
            el.autoplay = true
            el.style.display = 'none'
            document.body.appendChild(el)
            if (track.sid) audioElsRef.current.set(track.sid, el)
          }
        })
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove())
          if (track.sid) audioElsRef.current.delete(track.sid)
        })

        room.on(RoomEvent.Disconnected, () => {
          clearAll()
          finalizeStreaming()
          setPhase('idle')
          setMicLevel(0)
          setStatus((s) => (s === 'ended' ? s : 'ended'))
          setEndedAt((e) => e ?? Date.now())
          teardownRoom()
        })
        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) {
            setStatus((s) => (s === 'ended' ? s : 'reconnecting'))
          } else if (state === ConnectionState.Connected) {
            setStatus((s) => (s === 'ended' ? s : 'online'))
          }
        })

        await room.connect(session.livekit_url, session.token)
        await room.localParticipant.setMicrophoneEnabled(true)

        // Best-effort mic level meter for the LiveStage visualizer; safe to skip.
        try {
          const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone)
          const micTrack = pub?.track as LocalAudioTrack | undefined
          if (micTrack) {
            const { calculateVolume, cleanup } = createAudioAnalyser(micTrack)
            micMeterCleanupRef.current = () => {
              cleanup().catch(() => {})
            }
            every(() => setMicLevel(Math.min(1, calculateVolume() * 3)), 120)
          }
        } catch {
          /* mic level meter is a nice-to-have */
        }

        setStatus((s) => (s === 'ended' ? s : 'online'))
        setStartedAt(Date.now())
      } catch (err) {
        console.error('Failed to start the live session', err)
        pushEvent({ kind: 'guardrail', label: 'Connection failed', detail: err instanceof Error ? err.message : 'Could not reach the live session backend.' })
        teardownRoom()
        setStatus('ended')
        setEndedAt(Date.now())
      }
    })()
  }, [clearAll, every, finalizeStreaming, pushEvent, teardownRoom, upsertSegment])

  const connect = useCallback(() => {
    clearAll()
    teardownRoom()
    setItems([])
    turn.current = 0
    setPhase('idle')
    setEndedAt(null)

    if (!isDemoMode && startSessionRef.current) {
      connectReal()
      return
    }

    setStatus('connecting')
    later(() => {
      setStatus('online')
      setStartedAt(Date.now())
      if (greetingRef.current) later(() => streamReply(greetingRef.current!), 350)
    }, 1100)
  }, [clearAll, connectReal, later, streamReply, teardownRoom])

  const canTalk = status === 'online'

  const send = useCallback(
    (text: string, meta: { scenario?: string } = {}) => {
      const t = text.trim()
      if (!t || !canTalk) return false
      clearAll()
      finalizeStreaming()
      setMicLevel(0)
      pushMessage('user', t)
      const room = roomRef.current
      if (room) {
        // Real mode: the mic carries voice; typed text goes over LiveKit's text
        // data-stream channel so the backend agent can react to it too.
        room.localParticipant.sendText(t, { topic: 'lk-chat-topic' }).catch((err) => console.error('Failed to send message', err))
        return true
      }
      respond(t, { ...meta, spoken: false })
      return true
    },
    [canTalk, clearAll, finalizeStreaming, pushMessage, respond],
  )

  /** Simulate the user speaking: listening + mic level, then a transcribed utterance (demo mode). */
  const speak = useCallback(
    (prompt?: string, meta: { scenario?: string } = {}) => {
      if (!canTalk) return false
      if (roomRef.current) {
        // Real mode: the mic is already live and continuously published. A
        // scripted prompt (e.g. a quick-test chip) has no audio to play, so
        // send it as text instead; a plain "press to talk" is a no-op — real
        // transcription events drive phase/state from here.
        if (prompt) return send(prompt, meta)
        return true
      }
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
    [canTalk, clearAll, every, finalizeStreaming, later, pushMessage, respond, send, voicePrompts],
  )

  const end = useCallback(() => {
    clearAll()
    finalizeStreaming()
    setPhase('idle')
    setMicLevel(0)
    if (roomRef.current) {
      roomRef.current.localParticipant.setMicrophoneEnabled(false).catch(() => {})
      teardownRoom()
    }
    setStatus('ended')
    setEndedAt(Date.now())
  }, [clearAll, finalizeStreaming, teardownRoom])

  const reset = useCallback(() => {
    clearAll()
    teardownRoom()
    streamingId.current = null
    setItems([])
    setPhase('idle')
    setMicLevel(0)
    setStatus('idle')
    setStartedAt(null)
    setEndedAt(null)
    turn.current = 0
  }, [clearAll, teardownRoom])

  useEffect(() => {
    if (autoConnect) connect()
    // connect once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const messageCount = items.filter((i) => i.type === 'message').length

  return { status, phase, items, micLevel, messageCount, startedAt, endedAt, canTalk, connect, send, speak, end, reset }
}

export type LiveConversation = ReturnType<typeof useLiveConversation>
