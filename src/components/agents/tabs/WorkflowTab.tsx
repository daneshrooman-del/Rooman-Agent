import { useState } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import type { Agent, WorkflowNode } from '@/types'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/PageHeader'
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas'
import { useAgentActions } from '../useAgentActions'

export function WorkflowTab({ agent }: { agent: Agent }) {
  const { save, logActivity } = useAgentActions(agent)
  const [nodes, setNodes] = useState<WorkflowNode[]>(agent.workflow)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(nodes) !== JSON.stringify(agent.workflow)

  return (
    <div>
      <SectionHeader
        title="Workflow"
        description="How the agent moves through a conversation. Select a step to edit it."
        action={
          <div className="flex items-center gap-2">
            {dirty && (
              <Button variant="ghost" size="sm" leftIcon={<RotateCcw />} onClick={() => setNodes(agent.workflow)}>
                <span className="hidden sm:inline">Discard</span>
                <span className="sr-only sm:hidden">Discard changes</span>
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Save />}
              disabled={!dirty}
              loading={saving}
              onClick={async () => {
                setSaving(true)
                await save({ workflow: nodes, activity: logActivity(`Workflow updated (${nodes.length} steps)`, 'edit') }, { title: 'Workflow saved', description: `${agent.name} will follow the new flow on its next conversation.` })
                setSaving(false)
              }}
            >
              {dirty ? 'Save workflow' : 'Saved'}
            </Button>
          </div>
        }
      />
      <WorkflowCanvas nodes={nodes} onChange={setNodes} editable />
    </div>
  )
}
