import { Compass } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/States'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <EmptyState
      icon={<Compass />}
      title="This page doesn’t exist"
      description="The link may be outdated, or the item was removed."
      action={
        <>
          <ButtonLink to="/" variant="primary">
            Go home
          </ButtonLink>
          <ButtonLink to="/avatars">My Avatars</ButtonLink>
        </>
      }
    />
  )
}
