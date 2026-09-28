/* Keeps a (demo) avatar training job advancing in the workspace even when the
   user leaves the onboarding page. With a real backend this is where you'd
   poll GET /avatars/:id or subscribe to training events instead. */
import type { Avatar } from '@/types'

type Update = (id: string, patch: Partial<Avatar>) => void

const runners = new Map<string, number>()

/** Same ease-out curve as useSimulatedJob so the page and the workspace stay in step. */
const ease = (t: number) => Math.round((1 - Math.pow(1 - t, 1.6)) * 100)

export function startTraining(id: string, durationMs: number, update: Update) {
  stopTraining(id)
  const started = performance.now()
  let last = -1
  const timer = window.setInterval(() => {
    const t = Math.min((performance.now() - started) / durationMs, 1)
    const p = ease(t)
    if (t >= 1) {
      stopTraining(id)
      update(id, { status: 'ready', trainingProgress: 100 })
    } else if (p - last >= 3) {
      last = p
      update(id, { trainingProgress: p })
    }
  }, 500)
  runners.set(id, timer)
}

export function stopTraining(id: string) {
  const t = runners.get(id)
  if (t) window.clearInterval(t)
  runners.delete(id)
}
