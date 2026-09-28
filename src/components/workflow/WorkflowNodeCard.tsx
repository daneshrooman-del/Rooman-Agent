import { Check, CornerDownRight } from 'lucide-react'
import type { WorkflowNode } from '@/types'
import { cn } from '@/lib/cn'
import { nodeKinds } from './nodeKinds'

export function WorkflowNodeCard({
  node,
  index,
  editable,
  selected,
  active,
  branch,
  onSelect,
}: {
  node: WorkflowNode
  index: number
  editable: boolean
  selected: boolean
  active: boolean
  branch?: { yes: string; no: string }
  onSelect?: () => void
}) {
  const meta = nodeKinds[node.kind]
  const Icon = meta.icon
  const terminal = node.kind === 'start' || node.kind === 'end'

  const body = (
    <>
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-[11px] border sm:size-10"
        style={{ background: `rgb(${meta.rgb} / 0.12)`, borderColor: `rgb(${meta.rgb} / 0.28)`, color: `rgb(${meta.rgb})` }}
      >
        <Icon className="size-4 sm:size-[18px]" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: `rgb(${meta.rgb} / 0.9)` }}>
            {meta.label}
          </span>
          {!terminal && <span className="tabular text-[10px] text-fg-subtle">· {String(index).padStart(2, '0')}</span>}
        </span>
        <span className="mt-0.5 block truncate text-[14px] font-medium text-fg sm:text-[15px]">{node.label || 'Untitled step'}</span>
        {node.description && <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-fg-muted">{node.description}</span>}
      </span>
    </>
  )

  return (
    <div
      className={cn(
        'glass group relative w-full rounded-card transition-[border-color,box-shadow,transform] duration-300 ease-out-soft',
        selected && 'border-accent/60 shadow-[0_0_0_4px_rgb(143_124_255/0.12)]',
        active && !selected && 'shadow-[0_0_0_1px_rgb(143_124_255/0.5),0_0_40px_-8px_rgb(143_124_255/0.55)]',
      )}
    >
      {active && <span aria-hidden className="pointer-events-none absolute inset-0 animate-pulse-soft rounded-card bg-accent/[0.06]" />}
      {editable ? (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          aria-label={`${meta.label}: ${node.label}. Select to edit`}
          className="relative flex w-full items-start gap-3 rounded-card p-3.5 sm:gap-3.5 sm:p-4"
        >
          {body}
        </button>
      ) : (
        <div className="relative flex items-start gap-3 p-3.5 sm:gap-3.5 sm:p-4">{body}</div>
      )}

      {branch && (
        <div className="relative flex flex-wrap gap-1.5 border-t border-line px-3.5 py-2.5 sm:px-4">
          <span className="inline-flex h-6 items-center gap-1 rounded-full border border-success/20 bg-success/[0.08] px-2 text-[11px] text-success">
            <Check className="size-3" aria-hidden />
            {branch.yes}
          </span>
          <span className="inline-flex h-6 min-w-0 items-center gap-1 rounded-full border border-[#ff7a8e]/20 bg-[#ff7a8e]/[0.08] px-2 text-[11px] text-[#ff9aab]">
            <CornerDownRight className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{branch.no}</span>
          </span>
        </div>
      )}

    </div>
  )
}
