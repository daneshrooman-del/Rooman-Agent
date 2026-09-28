import { useSearchParams } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useWorkspace } from '@/state/workspace'
import { ButtonLink, EmptyState } from '@/components/ui'
import { useInitialAvatarId } from '@/components/avatar/AvatarPicker'
import { LiveExperience } from '@/components/live/LiveExperience'

export default function LiveAIPage() {
  useDocumentTitle('Live AI')
  const { data, avatarById } = useWorkspace()
  const [params] = useSearchParams()
  const initialAvatarId = useInitialAvatarId(params.get('avatar'))
  const agent = data?.agents.find((a) => a.id === params.get('agent'))
  if (!data) return null

  const agentAvatar = agent && avatarById(agent.avatarId)
  const avatarId = params.get('avatar') ? initialAvatarId : agentAvatar?.status === 'ready' ? agentAvatar.id : initialAvatarId

  if (!avatarById(avatarId)) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-5 lg:min-h-0 lg:py-16">
        <h1 className="sr-only">Live AI</h1>
        <EmptyState
          icon={<UserPlus />}
          title="Create an avatar to go live"
          description="Live conversations use your AI avatar’s face and voice. Create one to start talking."
          action={<ButtonLink to="/avatars/new" variant="primary">Create avatar</ButtonLink>}
        />
      </div>
    )
  }

  return <LiveExperience key={`${avatarId}-${agent?.id ?? ''}`} initialAvatarId={avatarId} agent={agent} />
}
