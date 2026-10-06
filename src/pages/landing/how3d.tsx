import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AudioLines, Bot, LayoutDashboard, Video } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Tilt3D } from '@/components/landing/editorial/Tilt3D'
import { useAutoStep } from './how3dHooks'

/* 3D pieces for the How it works page: a step prism and an orbit ring. */

const SHALYA = '/avatars/clips/shalya_rest.jpg'

/* ───────── prism: one face per step, turns to the active one ───────── */

export function Prism({ faces, active, label }: { faces: ReactNode[]; active: number; label: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [depth, setDepth] = useState(0)
  const n = faces.length
  const angle = 360 / n
  useEffect(() => {
    const el = host.current
    if (!el) return
    const ro = new ResizeObserver(() => setDepth(el.offsetWidth / (2 * Math.tan(Math.PI / n))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [n])
  return (
    <Tilt3D max={7}>
      <div className="[perspective:1600px]" role="img" aria-label={label}>
        <div
          ref={host}
          className="relative aspect-[4/5] w-full transition-transform duration-[900ms] [transform-style:preserve-3d] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateZ(${-depth}px) rotateY(${-active * angle}deg)` }}
        >
          {faces.map((f, k) => (
            <div
              key={k}
              aria-hidden={k !== active}
              className="absolute inset-0 overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--bg)] shadow-[0_30px_60px_-30px_rgba(29,58,154,0.55)] [backface-visibility:hidden]"
              style={{ transform: `rotateY(${k * angle}deg) translateZ(${depth}px)` }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    </Tilt3D>
  )
}

/* ───────── orbit ring for Stage 3 ───────── */

const ORBIT_ICONS = [AudioLines, Bot, Video, LayoutDashboard]

export function Orbit({ items }: { items: { title: string; body: string }[] }) {
  const n = items.length
  const { ref, i, pick } = useAutoStep(n, 3200)
  const ring = useRef<HTMLDivElement>(null)
  const [r, setR] = useState(260)
  useEffect(() => {
    const el = ring.current
    if (!el) return
    const ro = new ResizeObserver(() => setR(Math.max(110, Math.min(240, el.offsetWidth * 0.36))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const cur = items[i]
  return (
    <div ref={ref} className="grid items-center gap-8 lg:grid-cols-[1.25fr_1fr]">
      <div ref={ring} className="relative h-[400px] sm:h-[440px]">
        <img src={SHALYA} alt="Shalya, an AI avatar, in a live conversation" className="absolute left-1/2 top-[6%] size-32 -translate-x-1/2 rounded-full object-cover shadow-[0_24px_50px_-20px_rgba(29,58,154,0.8)] ring-4 ring-[var(--bg)] sm:size-40" />
        <span className="absolute left-1/2 top-[calc(6%+8.3rem)] -translate-x-1/2 rounded-full bg-[var(--ink)] px-3 py-1 text-[12px] font-semibold text-[var(--on-ink)] sm:top-[calc(6%+10.3rem)]">
          <span className="mr-1.5 inline-block size-2 animate-pulse-soft rounded-full bg-red-400" />Live
        </span>
        {/* oval track; cards travel round it and always face the viewer */}
        <span aria-hidden className="absolute left-1/2 top-[72%] h-[90px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-dashed border-[var(--accent)]/30" style={{ width: r * 2 }} />
        {items.map((it, k) => {
          const Icon = ORBIT_ICONS[k % ORBIT_ICONS.length]
          const theta = ((k - i) / n) * Math.PI * 2
          const x = Math.sin(theta) * r
          const z = Math.cos(theta) // 1 = front, -1 = back
          const front = k === i
          return (
            <button
              key={it.title}
              type="button"
              onClick={() => pick(k)}
              aria-pressed={front}
              className={cn(
                'absolute left-1/2 top-[72%] flex h-[84px] w-[150px] flex-col justify-center gap-1.5 rounded-2xl border px-4 text-left transition-all duration-[900ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]',
                front ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--on-ink)] shadow-[0_20px_40px_-18px_rgba(29,58,154,0.9)]' : 'border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] shadow-[0_12px_26px_-18px_rgba(29,58,154,0.6)] hover:border-[var(--accent)]',
              )}
              style={{
                transform: `translate(-50%, -50%) translate(${x}px, ${z * 34}px) scale(${0.72 + 0.28 * ((z + 1) / 2)})`,
                zIndex: Math.round((z + 1) * 10),
                opacity: 0.55 + 0.45 * ((z + 1) / 2),
              }}
            >
              <Icon className="size-5" aria-hidden />
              <span className="font-display text-[16px] font-bold">{it.title}</span>
            </button>
          )
        })}
      </div>
      <div key={i} className="s-card animate-fade-up !bg-[var(--bg)] p-7" aria-live="polite">
        <p className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--accent)]">Step {i + 1} of {n}</p>
        <h3 className="mt-2 font-display text-[26px] font-bold [font-stretch:108%]">{cur.title}</h3>
        <p className="mt-3 text-[16px] leading-relaxed text-[var(--muted)]">{cur.body}</p>
        <div className="mt-6 flex gap-2">
          {items.map((it, k) => (
            <button key={it.title} type="button" onClick={() => pick(k)} aria-label={`Show ${it.title}`} className={cn('h-2 rounded-full transition-all', k === i ? 'w-8 bg-[var(--ink)]' : 'w-2 bg-[var(--border)] hover:bg-[var(--accent)]')} />
          ))}
        </div>
      </div>
    </div>
  )
}
