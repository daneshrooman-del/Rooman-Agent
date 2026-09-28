import { useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useWorkspace } from '@/state/workspace'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useInitialAvatarId } from '@/components/avatar/AvatarPicker'
import { BuilderHero } from '@/components/builder/BuilderHero'
import { BuilderWorkspace } from '@/components/builder/BuilderWorkspace'
import type { FromLive } from '@/components/builder/templates'

export default function AgentBuilderPage() {
  useDocumentTitle('Agent Builder')
  const { data, avatarById } = useWorkspace()
  const [params] = useSearchParams()
  const location = useLocation()
  const fromLive = (location.state as { fromLive?: FromLive } | null)?.fromLive
  const avatarId = useInitialAvatarId(fromLive?.avatarId ?? params.get('avatar'))
  const [prompt, setPrompt] = useState<string | null>(null)
  const [run, setRun] = useState(0)

  if (!data) return null
  const avatar = avatarById(avatarId)

  if (!fromLive && prompt === null) {
    return <BuilderHero avatar={avatar} onSend={(t) => t.trim() && setPrompt(t.trim())} />
  }

  return (
    <BuilderWorkspace
      key={run}
      avatar={avatar}
      initialPrompt={prompt ?? undefined}
      fromLive={fromLive}
      onRestart={() => {
        setRun((r) => r + 1)
        if (!fromLive) setPrompt(null)
      }}
    />
  )
}
