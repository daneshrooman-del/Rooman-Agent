import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { AudioLines, BarChart3, BookOpen, Bot, LayoutGrid, Radio, Settings2, ShieldCheck, UserRound, Workflow, Wrench } from 'lucide-react'
import type { Channel } from '@/types'
import { useWorkspace } from '@/state/workspace'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/States'
import { TabPanel, Tabs } from '@/components/ui/Tabs'
import { AgentHeader } from '@/components/agents/AgentHeader'
import { DeployDialog } from '@/components/agents/DeployDialog'
import { QuickEditDialog } from '@/components/agents/QuickEditDialog'
import { channelMeta } from '@/components/agents/channels'
import { useAgentActions, useRemovedAgents } from '@/components/agents/useAgentActions'
import { OverviewTab } from '@/components/agents/tabs/OverviewTab'
import { LiveTestTab } from '@/components/agents/tabs/LiveTestTab'
import { WorkflowTab } from '@/components/agents/tabs/WorkflowTab'
import { ToolsTab } from '@/components/agents/tabs/ToolsTab'
import { GuardrailsTab } from '@/components/agents/tabs/GuardrailsTab'
import { AvatarTab } from '@/components/agents/tabs/AvatarTab'
import { VoiceTab } from '@/components/agents/tabs/VoiceTab'
import { AnalyticsTab } from '@/components/agents/tabs/AnalyticsTab'
import { SettingsTab } from '@/components/agents/tabs/SettingsTab'
import { KnowledgePanel } from '@/components/knowledge/KnowledgePanel'
import { useIndexingJobs } from '@/components/knowledge/useIndexingJobs'

const tabs = ['overview', 'test', 'knowledge', 'workflow', 'tools', 'guardrails', 'avatar', 'voice', 'analytics', 'settings'] as const
type Tab = (typeof tabs)[number]
const idBase = 'agent'

export default function AgentDetailPage() {
  const { agentId } = useParams()
  const [params, setParams] = useSearchParams()
  const { data, avatarById } = useWorkspace()
  const removed = useRemovedAgents()
  const agent = agentId && !removed.has(agentId) ? data?.agents.find((a) => a.id === agentId) : undefined
  const { save, logActivity } = useAgentActions(agent)
  useIndexingJobs(agent)
  const [deployOpen, setDeployOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  useDocumentTitle(agent?.name ?? 'Agent not found')

  const raw = params.get('tab')
  const tab: Tab = (tabs as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'overview'
  const setTab = (t: Tab) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (t === 'overview') n.delete('tab')
        else n.set('tab', t)
        return n
      },
      { replace: true },
    )
  const tabHref = (t: string) => `/agents/${agentId}?tab=${t}`

  if (!data) return null
  if (!agent) {
    return (
      <EmptyState
        className="mt-6"
        icon={<Bot />}
        title="This agent doesn't exist"
        description="It may have been deleted, or the link is incorrect."
        action={
          <ButtonLink to="/agents" variant="primary">
            Back to My Agents
          </ButtonLink>
        }
      />
    )
  }

  const avatar = avatarById(agent.avatarId)
  const readyKnowledge = agent.knowledge.length

  const deploy = (channels: Channel[]) => {
    setDeployOpen(false)
    const names = channels.map((c) => channelMeta[c].label).join(', ')
    save({ status: 'deploying', channels }, { title: 'Deploying…', description: `Rolling out to ${names}.`, tone: 'info' })
    window.setTimeout(() => {
      save(
        { status: 'live', channels, activity: logActivity(`Deployed to ${names}`, 'deploy') },
        { title: `${agent.name} is live`, description: `Answering on ${names}.` },
      )
    }, 2200)
  }

  const togglePause = () => {
    const paused = agent.status === 'paused'
    save(
      { status: paused ? 'live' : 'paused', activity: logActivity(paused ? 'Resumed on all channels' : 'Paused on all channels', 'edit') },
      paused ? { title: `${agent.name} resumed`, description: 'Answering on all enabled channels again.' } : { title: `${agent.name} paused`, description: 'Incoming conversations get a polite fallback.' },
    )
  }

  const items = [
    { value: 'overview' as const, label: 'Overview', icon: <LayoutGrid aria-hidden /> },
    { value: 'test' as const, label: 'Live Test', icon: <Radio aria-hidden /> },
    { value: 'knowledge' as const, label: 'Knowledge', icon: <BookOpen aria-hidden />, count: readyKnowledge },
    { value: 'workflow' as const, label: 'Workflow', icon: <Workflow aria-hidden /> },
    { value: 'tools' as const, label: 'Tools', icon: <Wrench aria-hidden /> },
    { value: 'guardrails' as const, label: 'Guardrails', icon: <ShieldCheck aria-hidden /> },
    { value: 'avatar' as const, label: 'Avatar', icon: <UserRound aria-hidden /> },
    { value: 'voice' as const, label: 'Voice', icon: <AudioLines aria-hidden /> },
    { value: 'analytics' as const, label: 'Analytics', icon: <BarChart3 aria-hidden /> },
    { value: 'settings' as const, label: 'Settings', icon: <Settings2 aria-hidden /> },
  ]

  return (
    <div>
      <AgentHeader
        agent={agent}
        avatar={avatar}
        onTest={() => setTab('test')}
        onTogglePause={togglePause}
        onEdit={() => setEditOpen(true)}
        onDeploy={() => setDeployOpen(true)}
      />

      <Tabs items={items} value={tab} onChange={setTab} label="Agent sections" idBase={idBase} className="mt-8" />

      <TabPanel idBase={idBase} value={tab} key={tab} className="pt-8">
        {tab === 'overview' && <OverviewTab agent={agent} avatar={avatar} tabHref={tabHref} />}
        {tab === 'test' && <LiveTestTab agent={agent} />}
        {tab === 'knowledge' && <KnowledgePanel agent={agent} />}
        {tab === 'workflow' && <WorkflowTab agent={agent} />}
        {tab === 'tools' && <ToolsTab agent={agent} />}
        {tab === 'guardrails' && <GuardrailsTab agent={agent} />}
        {tab === 'avatar' && <AvatarTab agent={agent} />}
        {tab === 'voice' && <VoiceTab agent={agent} />}
        {tab === 'analytics' && <AnalyticsTab agent={agent} onTest={() => setTab('test')} />}
        {tab === 'settings' && <SettingsTab agent={agent} />}
      </TabPanel>

      <DeployDialog agent={agent} open={deployOpen} onClose={() => setDeployOpen(false)} onDeploy={deploy} />
      <QuickEditDialog
        agent={agent}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={(p) => {
          setEditOpen(false)
          save({ ...p, activity: logActivity('Name and purpose updated', 'edit') }, { title: 'Agent updated' })
        }}
      />
    </div>
  )
}
