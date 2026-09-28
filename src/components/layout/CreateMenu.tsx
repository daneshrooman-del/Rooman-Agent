import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Clapperboard, Radio, UserRoundPlus } from 'lucide-react'
import { Menu } from '@/components/ui/Menu'

export const createActions = [
  { label: 'Create avatar', to: '/avatars/new', icon: UserRoundPlus },
  { label: 'Create video', to: '/create', icon: Clapperboard },
  { label: 'Go live', to: '/live', icon: Radio },
  { label: 'Build agent', to: '/agents/new', icon: Bot },
] as const

export function CreateMenu({ trigger, align = 'end', className }: { trigger: Parameters<typeof Menu>[0]['trigger']; align?: 'start' | 'end'; className?: string }): ReactNode {
  const navigate = useNavigate()
  return (
    <Menu
      label="Create"
      className={className}
      align={align}
      trigger={trigger}
      items={createActions.map((a) => ({ label: a.label, icon: <a.icon />, onSelect: () => navigate(a.to) }))}
    />
  )
}
