import { useEffect, useRef, useState } from 'react'

/** Whether the element is at least `threshold` visible in the viewport. */
export function useInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, inView] as const
}

/** True once the visitor has clicked/tapped/typed — browsers block audio playback before that. */
export function useUserActivated() {
  const [active, setActive] = useState(() => typeof navigator !== 'undefined' && !!navigator.userActivation?.hasBeenActive)
  useEffect(() => {
    if (active) return
    const on = () => setActive(true)
    window.addEventListener('pointerdown', on, { once: true })
    window.addEventListener('keydown', on, { once: true })
    return () => {
      window.removeEventListener('pointerdown', on)
      window.removeEventListener('keydown', on)
    }
  }, [active])
  return active
}
