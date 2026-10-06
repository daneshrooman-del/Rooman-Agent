import { useEffect, useRef, useState } from 'react'

export function useReduced() {
  const [r] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  return r
}

/** Advances 0..n-1 every `ms` while visible, until the user takes over (`stop`). */
export function useAutoStep(n: number, ms = 3800) {
  const reduced = useReduced()
  const ref = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(0)
  const [manual, setManual] = useState(false)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (reduced || manual || !visible) return
    const id = window.setInterval(() => setI((v) => (v + 1) % n), ms)
    return () => window.clearInterval(id)
  }, [reduced, manual, visible, n, ms])
  const pick = (k: number) => {
    setManual(true)
    setI(k)
  }
  return { ref, i, pick }
}

