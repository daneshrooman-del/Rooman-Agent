import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Camera, CircleStop, Mic, RotateCcw, Video } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/States'

/** Recording structure required by Tavus Phoenix face training: one continuous shot. */
const SPEAK_SECONDS = 30
const STILL_SECONDS = 30
const TOTAL = SPEAK_SECONDS + STILL_SECONDS

const SCRIPT =
  'Hi! I’m recording this video to create my AI digital twin. I’m speaking naturally, looking at the camera, in a quiet room with good light. ' +
  'My avatar will use my face and my voice to present, greet customers and answer questions. ' +
  'Once upon a time, people built a perfect park in the middle of a busy city. At sunrise, birds sang above the tall trees, and families carried baskets full of bread, fruit and juice.'

type Phase = 'off' | 'starting' | 'preview' | 'countdown' | 'speak' | 'still' | 'error'

function pickMime(): string {
  const options = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? ''
}

function describeError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : ''
  if (name === 'NotAllowedError') return 'Camera or microphone permission was denied. Allow access in your browser’s site settings and try again.'
  if (name === 'NotFoundError') return 'No camera or microphone was found. Connect one and try again.'
  if (name === 'NotReadableError') return 'Your camera is in use by another app (Zoom, Teams…). Close it and try again.'
  return 'Could not start the camera. Try another browser, or upload a recorded video instead.'
}

/**
 * Guided 1-minute recording in the browser: 30 s speaking + 30 s still.
 * Produces a WebM File passed to `onRecorded`. Nothing leaves the browser
 * until the user continues through consent.
 */
export function CameraRecorder({ onRecorded, onCancel }: { onRecorded: (file: File) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<number | undefined>(undefined)
  const [phase, setPhase] = useState<Phase>('off')
  const [error, setError] = useState<string | null>(null)
  const [res, setRes] = useState<{ w: number; h: number; fps: number } | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [count, setCount] = useState(3)

  const stopStream = useCallback(() => {
    window.clearInterval(timer.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => stopStream, [stopStream])

  const start = async () => {
    setError(null)
    setPhase('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      })
      streamRef.current = stream
      const s = stream.getVideoTracks()[0]?.getSettings() ?? {}
      setRes({ w: s.width ?? 0, h: s.height ?? 0, fps: Math.round(s.frameRate ?? 0) })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setPhase('preview')
    } catch (e) {
      setError(describeError(e))
      setPhase('error')
    }
  }

  const finish = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }, [])

  const record = () => {
    const stream = streamRef.current
    if (!stream) return
    setPhase('countdown')
    setCount(3)
    let n = 3
    timer.current = window.setInterval(() => {
      n -= 1
      setCount(n)
      if (n > 0) return
      window.clearInterval(timer.current)
      chunks.current = []
      const mime = pickMime()
      const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 128_000 })
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      rec.onstop = () => {
        const type = rec.mimeType || 'video/webm'
        const ext = type.includes('mp4') ? 'mp4' : 'webm'
        const file = new File(chunks.current, `camera-recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`, { type })
        stopStream()
        setPhase('off')
        onRecorded(file)
      }
      recorderRef.current = rec
      rec.start(1000)
      const began = performance.now()
      setElapsed(0)
      setPhase('speak')
      timer.current = window.setInterval(() => {
        const t = (performance.now() - began) / 1000
        setElapsed(t)
        if (t >= SPEAK_SECONDS) setPhase('still')
        if (t >= TOTAL + 0.5) {
          window.clearInterval(timer.current)
          finish()
        }
      }, 200)
    }, 1000)
  }

  const retake = () => {
    window.clearInterval(timer.current)
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null
      rec.stop()
    }
    setElapsed(0)
    setPhase('preview')
  }

  const lowRes = res && Math.min(res.w, res.h) > 0 && Math.min(res.w, res.h) < 1080
  const recording = phase === 'speak' || phase === 'still'
  const remaining = Math.max(0, Math.ceil((phase === 'speak' ? SPEAK_SECONDS : TOTAL) - elapsed))

  return (
    <div className="rounded-panel border border-line bg-surface p-3 sm:p-4 animate-fade-up">
      <div className="relative aspect-video overflow-hidden rounded-[16px] bg-black">
        <video ref={videoRef} muted playsInline className={cn('size-full -scale-x-100 object-cover', phase === 'off' || phase === 'error' ? 'opacity-0' : 'opacity-100')} />

        {/* framing guide: chest-up, face centred */}
        {(phase === 'preview' || phase === 'countdown' || recording) && (
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[62%] w-[26%] rounded-[50%] border-2 border-dashed border-white/35" />
          </div>
        )}

        {phase === 'off' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-[18px] border border-line-strong bg-white/[0.05]">
              <Camera className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-[15px] font-semibold">Record with your camera</p>
              <p className="mt-1 max-w-sm text-[13px] text-fg-muted">About 1 minute: talk for 30 seconds, then sit still for 30 seconds. We’ll guide you.</p>
            </div>
            <Button variant="primary" leftIcon={<Video aria-hidden />} onClick={() => void start()}>
              Turn on camera
            </Button>
          </div>
        )}

        {phase === 'starting' && <p className="absolute inset-0 flex items-center justify-center text-[13px] text-fg-muted">Starting camera…</p>}

        {phase === 'error' && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <AlertTriangle className="size-6 text-danger" aria-hidden />
            <p className="max-w-sm text-[13px] text-fg-muted">{error}</p>
            <Button onClick={() => void start()}>Try again</Button>
          </div>
        )}

        {phase === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-[88px] font-semibold tabular" aria-live="assertive">
              {count}
            </span>
          </div>
        )}

        {recording && (
          <>
            <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-[12px] font-medium backdrop-blur">
              <span className="size-2 animate-pulse-soft rounded-full bg-live" aria-hidden /> REC {Math.floor(elapsed)}s / {TOTAL}s
            </span>
            <div className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4">
              <div className="glass-strong rounded-[14px] p-3 sm:p-4" aria-live="polite">
                {phase === 'speak' ? (
                  <>
                    <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-accent">
                      <Mic className="size-3.5" aria-hidden /> Part 1 · Speak naturally · {remaining}s
                    </p>
                    <p className="mt-1.5 text-[14px] leading-relaxed sm:text-[15px]">{SCRIPT}</p>
                  </>
                ) : (
                  <p className="text-[14px] sm:text-[15px]">
                    <span className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-success">Part 2 · Stay still · {remaining}s</span>
                    Keep looking at the camera. Lips closed, head still, relaxed face.
                  </p>
                )}
                <ProgressBar value={(elapsed / TOTAL) * 100} className="mt-3" label="Recording progress" />
              </div>
            </div>
          </>
        )}
      </div>

      {(phase === 'preview' || recording) && (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className={cn('text-[12px]', lowRes ? 'text-warning' : 'text-fg-subtle')}>
            {res ? `Camera: ${res.w}×${res.h}${res.fps ? ` · ${res.fps} fps` : ''}` : ''}
            {lowRes && ' — below 1080p. It will work but look softer; a 1080p webcam or phone gives the best result.'}
            {!lowRes && phase === 'preview' && ' · Sit chest-up inside the outline, face the light.'}
          </p>
          <div className="flex shrink-0 gap-2">
            {phase === 'preview' ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => { stopStream(); setPhase('off'); onCancel() }}>
                  Cancel
                </Button>
                <Button variant="accent" size="sm" leftIcon={<span className="size-2 rounded-full bg-white" aria-hidden />} onClick={record}>
                  Start recording
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" leftIcon={<RotateCcw aria-hidden />} onClick={retake}>
                  Retake
                </Button>
                <Button variant="secondary" size="sm" leftIcon={<CircleStop aria-hidden />} onClick={finish} disabled={elapsed < TOTAL - 5}>
                  Finish
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
