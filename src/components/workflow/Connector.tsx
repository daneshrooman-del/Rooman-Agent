import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Thin gradient line between two nodes, ending in a small arrowhead. Optional insert (+) control. */
export function Connector({ from, to, onInsert, className, style }: { from: string; to: string; onInsert?: () => void; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cn('relative flex h-9 flex-col items-center sm:h-11', className)} style={style} aria-hidden={!onInsert}>
      <span className="w-px flex-1" style={{ background: `linear-gradient(180deg, rgb(${from} / 0.55), rgb(${to} / 0.55))` }} />
      <svg viewBox="0 0 10 6" className="-mt-px h-[6px] w-[10px]" aria-hidden>
        <path d="M0 0 L5 6 L10 0 Z" fill={`rgb(${to} / 0.7)`} />
      </svg>
      {onInsert && (
        <button
          type="button"
          onClick={onInsert}
          aria-label="Add a step here"
          className="absolute left-1/2 top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-fg-subtle opacity-70 transition-all duration-200 hover:scale-110 hover:border-accent/60 hover:text-fg hover:opacity-100 focus-visible:opacity-100"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  )
}
