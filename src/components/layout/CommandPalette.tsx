import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Bot, Clapperboard, CornerDownLeft, Search, UserRound, Video as VideoIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useWorkspace } from '@/state/workspace'
import { libraryNav, primaryNav, settingsNav } from '@/components/navigation/nav'
import { createActions } from './CreateMenu'

interface Result {
  id: string
  label: string
  group: string
  to: string
  icon: React.ComponentType<{ className?: string }>
  hint?: string
}

/** ⌘K global search across pages, avatars, videos and agents. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { data } = useWorkspace()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      setQ('')
      setActive(0)
      requestAnimationFrame(() => input.current?.focus())
    }
    if (!open && el.open) el.close()
  }, [open])

  const all = useMemo<Result[]>(() => {
    const pages: Result[] = [...primaryNav, ...libraryNav, settingsNav].map((n) => ({ id: n.to, label: n.label, group: 'Go to', to: n.to, icon: n.icon }))
    const actions: Result[] = createActions.map((a) => ({ id: a.to, label: a.label, group: 'Create', to: a.to, icon: a.icon }))
    const avatars: Result[] = (data?.avatars ?? []).map((a) => ({ id: a.id, label: a.name, group: 'Avatars', to: `/avatars/${a.id}`, icon: UserRound, hint: a.kind }))
    const agents: Result[] = (data?.agents ?? []).map((a) => ({ id: a.id, label: a.name, group: 'Agents', to: `/agents/${a.id}`, icon: Bot, hint: a.status }))
    const videos: Result[] = (data?.videos ?? []).map((v) => ({ id: v.id, label: v.title, group: 'Videos', to: `/videos?v=${v.id}`, icon: VideoIcon, hint: v.status }))
    return [...actions, ...pages, ...avatars, ...agents, ...videos]
  }, [data])

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = s ? all.filter((r) => r.label.toLowerCase().includes(s) || r.group.toLowerCase().includes(s)) : all.filter((r) => r.group === 'Create' || r.group === 'Go to')
    return list.slice(0, 12)
  }, [q, all])

  const go = (r: Result | undefined) => {
    if (!r) return
    onClose()
    navigate(r.to)
  }

  let lastGroup = ''
  return (
    <dialog
      ref={ref}
      aria-label="Search"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="glass-strong mx-auto mt-[12vh] w-[calc(100%-32px)] max-w-xl rounded-panel p-0 text-fg shadow-[0_40px_120px_-20px_rgb(0_0_0/0.9)] backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-fade-up"
    >
      {open && (
        <div>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search className="size-4 text-fg-subtle" aria-hidden />
            <input
              ref={input}
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setActive(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1))
                else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
                else if (e.key === 'Enter') go(results[active])
                else return
                e.preventDefault()
              }}
              placeholder="Search avatars, videos, agents…"
              aria-label="Search"
              aria-controls="palette-results"
              aria-activedescendant={results[active] ? `pal-${results[active].id}` : undefined}
              className="h-14 flex-1 bg-transparent text-[15px] placeholder:text-fg-subtle focus:outline-none"
            />
            <kbd className="rounded-md border border-line-strong px-1.5 py-0.5 text-[11px] text-fg-subtle">Esc</kbd>
          </div>
          <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
            {results.length === 0 && (
              <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[13px] text-fg-muted">
                <Clapperboard className="size-5 text-fg-subtle" aria-hidden />
                No results for “{q}”
              </li>
            )}
            {results.map((r, i) => {
              const header = r.group !== lastGroup
              lastGroup = r.group
              const Icon = r.icon
              return (
                <li key={`${r.group}-${r.id}`} role="presentation">
                  {header && <p className="px-2.5 pb-1.5 pt-3 text-[11px] font-medium uppercase tracking-[0.12em] text-fg-subtle first:pt-1">{r.group}</p>}
                  <div
                    id={`pal-${r.id}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(r)}
                    className={cn('flex cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-[14px]', i === active ? 'bg-white/[0.08] text-fg' : 'text-fg-muted')}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 truncate">{r.label}</span>
                    {r.hint && <span className="text-[12px] capitalize text-fg-subtle">{r.hint}</span>}
                    {i === active && (r.group === 'Create' ? <ArrowRight className="size-3.5" /> : <CornerDownLeft className="size-3.5" />)}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </dialog>
  )
}
