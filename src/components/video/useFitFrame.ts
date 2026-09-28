import { useLayoutEffect, useRef, useState } from 'react'

/** Largest box of `ratio` (w/h) that fits inside the observed element, minus `pad` px per side. */
export function useFitFrame<T extends HTMLElement>(ratio: number, pad = 0) {
  const ref = useRef<T>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const W = Math.max(0, el.clientWidth - pad * 2)
      const H = Math.max(0, el.clientHeight - pad * 2)
      const w = Math.floor(Math.min(W, H * ratio))
      setBox({ w, h: Math.floor(w / ratio) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ratio, pad])

  return { ref, ...box }
}
