import { Link, useParams } from 'react-router-dom'
import { ChevronRight, UserX } from 'lucide-react'
import { useWorkspace } from '@/state/workspace'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ButtonLink } from '@/components/ui/Button'
import { DemoNote, EmptyState } from '@/components/ui/States'
import { AvatarHero } from '@/components/avatar/detail/AvatarHero'
import { AvatarUsage } from '@/components/avatar/detail/AvatarUsage'

export default function AvatarDetailPage() {
  const { avatarId } = useParams()
  const { data, avatarById, isDemo } = useWorkspace()
  const avatar = avatarById(avatarId)
  useDocumentTitle(avatar?.name ?? 'Avatar not found')

  if (!data) return null

  if (!avatar) {
    return (
      <div className="mx-auto max-w-2xl pt-8">
        <h1 className="sr-only">Avatar not found</h1>
        <EmptyState
          icon={<UserX aria-hidden />}
          title="We couldn’t find that avatar"
          description="It may have been deleted, or the link is incorrect. Your other avatars are safe in My Avatars."
          action={
            <>
              <ButtonLink to="/avatars" variant="primary">
                Back to My Avatars
              </ButtonLink>
              <ButtonLink to="/avatars/new" variant="secondary">
                Create an avatar
              </ButtonLink>
            </>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-6 sm:mb-8">
        <ol className="flex items-center gap-1.5 text-[13px] text-fg-subtle">
          <li>
            <Link to="/avatars" className="hover:text-fg">
              My Avatars
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-3.5" />
          </li>
          <li aria-current="page" className="truncate text-fg-muted">
            {avatar.name}
          </li>
        </ol>
      </nav>

      <AvatarHero avatar={avatar} />

      <div className="mt-16">
        <AvatarUsage avatar={avatar} />
      </div>

      {isDemo && <DemoNote className="mt-10" />}
    </div>
  )
}
