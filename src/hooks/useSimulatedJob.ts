import { useCallback, useEffect, useRef, useState } from 'react'

export type JobState = 'idle' | 'running' | 'done' | 'failed'

/**
 * Drives a multi-stage progress UI (avatar training, video render, agent build).
 * In demo mode progress is simulated; with a real backend, call `setProgress`
 * from polling / websocket events instead of relying on the timer.
 */
export function useSimulatedJob(stageCount: number, { durationMs = 9000 } = {}) {
  const [state, setState] = useState<JobState>('idle')
  const [progress, setProgress] = useState(0)
  const timer = useRef<number | null>(null)

  const stop = () => {
    if (timer.current) window.clearInterval(timer.current)
    timer.current = null
  }

  const start = useCallback(() => {
    stop()
    setProgress(0)
    setState('running')
    const started = performance.now()
    timer.current = window.setInterval(() => {
      const t = Math.min((performance.now() - started) / durationMs, 1)
      // ease-out so the end feels deliberate
      setProgress(Math.round((1 - Math.pow(1 - t, 1.6)) * 100))
      if (t >= 1) {
        stop()
        setState('done')
      }
    }, 120)
  }, [durationMs])

  const reset = useCallback(() => {
    stop()
    setState('idle')
    setProgress(0)
  }, [])

  useEffect(() => stop, [])

  const stage = Math.min(Math.floor((progress / 100) * stageCount), stageCount - 1)
  return { state, progress, stage, start, reset, setProgress, setState }
}
