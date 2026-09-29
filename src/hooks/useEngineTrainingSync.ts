import { useEffect, useRef } from 'react'
import { engine, engineEnabled } from '@/lib/avatarEngine'
import { useWorkspace } from '@/state/workspace'

/**
 * Keeps engine avatars that are still training up to date on every page
 * (the onboarding screen polls only while it's open). Mounted once in AppShell.
 */
export function useEngineTrainingSync(intervalMs = 3000) {
  const { data, updateAvatar } = useWorkspace()
  const update = useRef(updateAvatar)
  update.current = updateAvatar
  const training = (data?.avatars ?? []).filter((a) => a.engine && a.status === 'training').map((a) => a.id)
  const key = training.join(',')

  useEffect(() => {
    if (!engineEnabled || !key) return
    const ids = key.split(',')
    const tick = () =>
      ids.forEach((id) =>
        engine
          .avatarStatus(id)
          .then((s) => update.current(id, { status: s.status, trainingProgress: s.trainingProgress, thumbnailUrl: s.thumbnailUrl, voiceLabel: s.voiceLabel }))
          .catch(() => {}),
      )
    tick()
    const t = window.setInterval(tick, intervalMs)
    return () => window.clearInterval(t)
  }, [key, intervalMs])
}
