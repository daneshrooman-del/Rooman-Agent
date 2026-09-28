import { useState } from 'react'
import type { Avatar } from '@/types'
import { api } from '@/lib/api'
import { pluralize } from '@/lib/format'
import { useWorkspace } from '@/state/workspace'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'

/** Confirms deletion, warning about every experience that depends on this identity. */
export function DeleteAvatarDialog({ avatar, open, onClose, onDeleted }: { avatar: Avatar; open: boolean; onClose: () => void; onDeleted?: () => void }) {
  const { data, removeAvatar } = useWorkspace()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const agents = (data?.agents ?? []).filter((a) => a.avatarId === avatar.id)

  const confirm = async () => {
    setBusy(true)
    try {
      await api.deleteAvatar(avatar.id)
      onClose()
      onDeleted?.()
      removeAvatar(avatar.id)
      toast({ title: `${avatar.name} deleted`, description: 'The avatar, its voice model and reference footage were removed.' })
    } catch {
      toast({ title: 'Could not delete avatar', description: 'Please try again.', tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={`Delete ${avatar.name}?`}
      description="This permanently removes the avatar identity, its voice model and the reference footage used to train it."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" loading={busy} onClick={confirm}>
            Delete avatar
          </Button>
        </>
      }
    >
      {(avatar.usage.videos > 0 || agents.length > 0) && (
        <div className="rounded-[12px] border border-danger/20 bg-danger/[0.06] p-4 text-[13px] text-fg-muted">
          <p className="font-medium text-fg">This identity is in use</p>
          <p className="mt-1">
            {pluralize(avatar.usage.videos, 'video')} and {pluralize(agents.length, 'agent')} use {avatar.name}. Existing videos stay in your library; agents will need a new avatar before they can go live.
          </p>
        </div>
      )}
    </Dialog>
  )
}
