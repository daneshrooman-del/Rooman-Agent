import { Fragment, useState } from 'react'
import { Plus } from 'lucide-react'
import type { WorkflowNode } from '@/types'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Connector } from './Connector'
import { NodeInspector } from './NodeInspector'
import { WorkflowNodeCard } from './WorkflowNodeCard'
import { newNodeId, nodeKinds } from './nodeKinds'

export interface WorkflowCanvasProps {
  nodes: WorkflowNode[]
  onChange?: (nodes: WorkflowNode[]) => void
  /** Enables selection, inspector, insert (+), move and delete. */
  editable?: boolean
  /** Nodes appear progressively (staggered fade-up) on mount. */
  animateIn?: boolean
  /** Highlights the node the agent is currently executing. */
  activeId?: string
  className?: string
}

function branchFor(nodes: WorkflowNode[], i: number) {
  if (nodes[i].kind !== 'decision') return undefined
  const rest = nodes.slice(i + 1)
  const handoff = rest.find((n) => n.kind === 'handoff')
  return { yes: 'Match → continue', no: handoff ? 'No match → Human handoff' : 'No → End conversation' }
}

/** A clean vertical flow: START ↓ steps ↓ END / handoff. */
export function WorkflowCanvas({ nodes, onChange, editable = false, animateIn = false, activeId, className }: WorkflowCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selIndex = nodes.findIndex((n) => n.id === selectedId)
  const selected = selIndex >= 0 ? nodes[selIndex] : undefined

  const emit = (next: WorkflowNode[]) => onChange?.(next)
  const insertAt = (at: number) => {
    const node: WorkflowNode = { id: newNodeId(), label: 'New step', kind: 'step', description: '' }
    emit([...nodes.slice(0, at), node, ...nodes.slice(at)])
    setSelectedId(node.id)
  }
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= nodes.length) return
    const next = [...nodes]
    ;[next[i], next[j]] = [next[j], next[i]]
    emit(next)
  }
  const remove = (i: number) => {
    if (nodes.length <= 1) return
    emit(nodes.filter((_, k) => k !== i))
    setSelectedId(null)
  }
  const patch = (i: number, p: Partial<WorkflowNode>) => emit(nodes.map((n, k) => (k === i ? { ...n, ...p } : n)))

  const delay = (i: number) => (animateIn ? { animationDelay: `${i * 110}ms` } : undefined)
  const anim = animateIn ? 'animate-fade-up' : undefined

  const inspector = (
    <NodeInspector
      node={selected}
      index={selIndex}
      total={nodes.length}
      onChange={(p) => patch(selIndex, p)}
      onMove={(d) => move(selIndex, d)}
      onDelete={() => remove(selIndex)}
    />
  )

  const flow = (
    <div className="relative overflow-hidden rounded-panel border border-line bg-[radial-gradient(80%_60%_at_50%_0%,rgb(143_124_255/0.08),transparent_70%)] px-4 py-6 sm:px-8 sm:py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 grid-lines opacity-30 [mask-image:radial-gradient(70%_70%_at_50%_40%,black,transparent)]" />
      <ol className="relative mx-auto flex w-full max-w-[440px] flex-col items-stretch" aria-label="Workflow steps">
        {nodes.map((n, i) => {
          const next = nodes[i + 1]
          return (
            <Fragment key={n.id}>
              <li className={anim} style={delay(i * 2)}>
                <WorkflowNodeCard
                  node={n}
                  index={i}
                  editable={editable}
                  selected={editable && n.id === selectedId}
                  active={n.id === activeId}
                  branch={branchFor(nodes, i)}
                  onSelect={() => setSelectedId((s) => (s === n.id ? null : n.id))}
                />
                {editable && n.id === selectedId && (
                  <div className="surface mt-2 animate-fade-up rounded-card lg:hidden">{inspector}</div>
                )}
              </li>
              {next && (
                <li aria-hidden={!editable} className={anim} style={delay(i * 2 + 1)}>
                  <Connector from={nodeKinds[n.kind].rgb} to={nodeKinds[next.kind].rgb} onInsert={editable ? () => insertAt(i + 1) : undefined} />
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
      {editable && (
        <div className="relative mt-5 flex justify-center">
          <Button size="sm" variant="ghost" leftIcon={<Plus />} onClick={() => insertAt(nodes.length)}>
            Add step at end
          </Button>
        </div>
      )}
    </div>
  )

  if (!editable) return <div className={className}>{flow}</div>

  return (
    <div className={cn('grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]', className)}>
      {flow}
      <div className="hidden lg:block">
        <aside aria-label="Step inspector" className="surface sticky top-24 rounded-panel">
          {inspector}
        </aside>
      </div>
    </div>
  )
}
