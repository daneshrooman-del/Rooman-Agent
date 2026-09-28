import { useId } from 'react'
import { ArrowDown, ArrowUp, MousePointerClick, Trash2 } from 'lucide-react'
import type { WorkflowNode } from '@/types'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { nodeKindOptions, nodeKinds, type NodeKind } from './nodeKinds'

export function NodeInspector({
  node,
  index,
  total,
  onChange,
  onMove,
  onDelete,
}: {
  node: WorkflowNode | undefined
  index: number
  total: number
  onChange: (patch: Partial<WorkflowNode>) => void
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
}) {
  const id = useId()
  if (!node) {
    return (
      <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <span className="flex size-11 items-center justify-center rounded-[14px] border border-line-strong bg-white/[0.04] text-fg-muted">
          <MousePointerClick className="size-5" aria-hidden />
        </span>
        <p className="text-[14px] font-medium">Select a step to edit it</p>
        <p className="max-w-60 text-[13px] text-fg-muted">Use the + between steps to insert a new one. Move steps with the arrow controls.</p>
      </div>
    )
  }
  const meta = nodeKinds[node.kind]
  return (
    <div className="flex flex-col gap-5 p-5" aria-live="polite">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Step {index + 1} of {total}</p>
        <p className="mt-1 text-[13px] text-fg-muted">{meta.hint}</p>
      </div>
      <Field label="Label" htmlFor={`${id}-label`}>
        <Input id={`${id}-label`} value={node.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="e.g. Collect job details" />
      </Field>
      <Field label="Type" htmlFor={`${id}-kind`}>
        <Select id={`${id}-kind`} value={node.kind} onChange={(e) => onChange({ kind: e.target.value as NodeKind })} options={nodeKindOptions} />
      </Field>
      <Field label="What happens here" htmlFor={`${id}-desc`} hint="Plain language — the agent follows this as an instruction.">
        <Textarea id={`${id}-desc`} value={node.description ?? ''} onChange={(e) => onChange({ description: e.target.value })} className="min-h-24" />
      </Field>
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button size="sm" variant="secondary" leftIcon={<ArrowUp />} disabled={index === 0} onClick={() => onMove(-1)}>
          Up
        </Button>
        <Button size="sm" variant="secondary" leftIcon={<ArrowDown />} disabled={index === total - 1} onClick={() => onMove(1)}>
          Down
        </Button>
        <Button size="sm" variant="destructive" leftIcon={<Trash2 />} disabled={total <= 1} onClick={onDelete} className="ml-auto">
          Delete
        </Button>
      </div>
    </div>
  )
}
