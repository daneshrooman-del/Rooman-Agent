import { ArrowRight, UserRoundPlus } from 'lucide-react'
import { useWorkspace } from '@/state/workspace'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ButtonLink } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/PageHeader'
import { DemoNote, EmptyState } from '@/components/ui/States'
import { HomeHero } from '@/components/home/HomeHero'
import { WorkspaceStats } from '@/components/home/WorkspaceStats'
import { ContinueRow } from '@/components/home/ContinueRow'
import { CreateCards } from '@/components/home/CreateCards'

export default function HomePage() {
  useDocumentTitle('Home')
  const { data, primaryAvatar, isDemo } = useWorkspace()
  if (!data) return null

  const firstName = data.user.name.split(' ')[0]

  return (
    <div className="flex flex-col">
      <p className="mb-4 text-[14px] text-fg-muted">
        Welcome back, <span className="text-fg">{firstName}</span>
      </p>
      <HomeHero avatar={primaryAvatar} />

      {data.avatars.length === 0 ? (
        <EmptyState
          className="mt-12"
          icon={<UserRoundPlus />}
          title="You don't have an avatar yet."
          description="Your avatar is the identity behind every video, live conversation and agent. Start with a short reference video."
          action={
            <ButtonLink to="/avatars/new" variant="primary">
              Create your first avatar
            </ButtonLink>
          }
        />
      ) : (
        <>
          <section className="mt-14" aria-labelledby="ws-title">
            <SectionHeader title={<span id="ws-title">Your AI workspace</span>} action={isDemo && <span className="hidden sm:block"><DemoNote /></span>} />
            <WorkspaceStats data={data} avatar={primaryAvatar} />
          </section>

          <section className="mt-14" aria-labelledby="continue-title">
            <SectionHeader
              title={<span id="continue-title">Continue where you left off</span>}
              action={
                <ButtonLink to="/videos" variant="ghost" size="sm" rightIcon={<ArrowRight />}>
                  View library
                </ButtonLink>
              }
            />
            <ContinueRow data={data} />
          </section>
        </>
      )}

      <section className="mt-14" aria-labelledby="create-title">
        <SectionHeader title={<span id="create-title">Create something new</span>} description="Every experience starts from the same identity." />
        <CreateCards avatar={primaryAvatar} />
      </section>
    </div>
  )
}
