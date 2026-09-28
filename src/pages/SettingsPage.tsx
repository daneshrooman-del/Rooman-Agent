import type { ComponentType } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useWorkspace } from '@/state/workspace'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { DemoNote, PageHeader } from '@/components/ui'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { isSectionId, sections, type SectionId } from '@/components/settings/shared'
import { NotificationsSection, ProfileSection, WorkspaceSection } from '@/components/settings/AccountSections'
import { BillingSection } from '@/components/settings/BillingSection'
import { ApiKeysSection } from '@/components/settings/ApiKeysSection'
import { TeamSection } from '@/components/settings/TeamSection'
import { AvatarSettingsSection, SecuritySection, VoiceSettingsSection } from '@/components/settings/IdentitySections'

const panels: Record<SectionId, ComponentType> = {
  profile: ProfileSection,
  workspace: WorkspaceSection,
  billing: BillingSection,
  'api-keys': ApiKeysSection,
  team: TeamSection,
  notifications: NotificationsSection,
  security: SecuritySection,
  avatar: AvatarSettingsSection,
  voice: VoiceSettingsSection,
}

export default function SettingsPage() {
  const { data, isDemo } = useWorkspace()
  const [params, setParams] = useSearchParams()
  const raw = params.get('section')
  const section: SectionId = isSectionId(raw) ? raw : 'profile'
  const label = sections.find((s) => s.id === section)!.label
  useDocumentTitle(`${label} · Settings`)
  if (!data) return null
  const Panel = panels[section]

  return (
    <div className="flex flex-col">
      <PageHeader title="Settings" description="Your account, workspace and the defaults every avatar experience starts from." />
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <SettingsNav
            value={section}
            onChange={(id) => {
              setParams({ section: id })
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          />
        </aside>
        <div className="min-w-0 max-w-3xl">
          {/* key forces a fresh form per section so unsaved edits don't leak between them */}
          <Panel key={section} />
          {isDemo && <DemoNote className="mt-6">Demo workspace — changes are confirmed but not stored.</DemoNote>}
        </div>
      </div>
    </div>
  )
}
