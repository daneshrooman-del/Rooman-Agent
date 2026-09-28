import { Flag, GitBranch, MessageSquareText, Play, UserRound, Wrench, type LucideIcon } from 'lucide-react'
import type { WorkflowNode } from '@/types'

export type NodeKind = WorkflowNode['kind']

/** Visual language for each workflow node kind — restrained tints, one icon each. */
export const nodeKinds: Record<NodeKind, { label: string; icon: LucideIcon; rgb: string; hint: string }> = {
  start: { label: 'Start', icon: Play, rgb: '62 213 152', hint: 'Where every conversation begins' },
  step: { label: 'Step', icon: MessageSquareText, rgb: '143 124 255', hint: 'The agent talks, asks or explains' },
  decision: { label: 'Decision', icon: GitBranch, rgb: '242 181 75', hint: 'Branches based on what the agent learns' },
  tool: { label: 'Tool', icon: Wrench, rgb: '91 141 255', hint: 'Looks something up or takes an action' },
  end: { label: 'End', icon: Flag, rgb: '62 213 152', hint: 'The goal is complete' },
  handoff: { label: 'Handoff', icon: UserRound, rgb: '255 122 142', hint: 'Routes to a person with full context' },
}

export const nodeKindOptions = (Object.keys(nodeKinds) as NodeKind[]).map((k) => ({ value: k, label: nodeKinds[k].label }))

export const newNodeId = () => `n_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
