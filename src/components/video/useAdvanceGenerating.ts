import { useEffect, useRef } from 'react'
import { useWorkspace } from '@/state/workspace'
import { estimateDuration } from './studio'

/**
 * Demo helper: while a page is open, nudges any `generating` video forward
 * until it finishes (no other job drives it once the studio is closed).
 * With a real backend this would be replaced by polling / websocket updates.
 */
export function useAdvanceGenerating(enabled: boolean, stepMs = 900) {
  const { data, updateVideo } = useWorkspace()
  const videosRef = useRef(data?.videos ?? [])
  videosRef.current = data?.videos ?? []
  const update = useRef(updateVideo)
  update.current = updateVideo
  const hasActive = (data?.videos ?? []).some((v) => v.status === 'generating')

  useEffect(() => {
    if (!enabled || !hasActive) return
    const id = window.setInterval(() => {
      for (const v of videosRef.current) {
        if (v.status !== 'generating') continue
        const next = Math.min(100, (v.progress ?? 0) + 2 + Math.round(Math.random() * 3))
        if (next >= 100) {
          update.current(v.id, {
            status: 'ready',
            progress: 100,
            durationSec: v.durationSec || estimateDuration(v.prompt, v.action),
            consistencyVerified: true,
          })
        } else update.current(v.id, { progress: next })
      }
    }, stepMs)
    return () => window.clearInterval(id)
  }, [enabled, hasActive, stepMs])
}
