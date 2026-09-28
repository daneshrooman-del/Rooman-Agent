import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bot, Clapperboard, MoreHorizontal, Pencil, Radio, Star, Trash2 } from 'lucide-react'
import type { Avatar } from '@/types'
import { formatDate } from '@/lib/format'
import { useWorkspace } from '@/state/workspace'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { ProgressBar } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { AvatarPreview } from './AvatarPreview'
import { DeleteAvatarDialog } from './DeleteAvatarDialog'

export function AvatarCard({ avatar }: { avatar: Avatar }) {
  const navigate = useNavigate()
  const { data, voiceName, updateAvatar } = useWorkspace()
  const toast = useToast()
  const ready = avatar.status === 'ready'
  const href = `/avatars/${avatar.id}`
  const [confirmDelete, setConfirmDelete] = useState(false)

  const setPrimary = () => {
    data?.avatars.forEach((a) => a.primary && a.id !== avatar.id && updateAvatar(a.id, { primary: false }))
    updateAvatar(avatar.id, { primary: true })
    toast({ title: `${avatar.name} is now your primary avatar`, description: 'New videos, live sessions and agents will default to it.' })
  }

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-soft transition-[transform,box-shadow,border-color] duration-300 ease-out-soft hover:-translate-y-1 hover:border-line-strong hover:shadow-[0_30px_70px_-30px_rgb(0_0_0/0.9),0_0_0_1px_rgb(143_124_255/0.16),0_0_60px_-20px_rgb(122_99_255/0.35)]">
      <Link to={href} aria-label={`Open ${avatar.name}`} className="relative block">
        <AvatarPreview
          avatar={avatar}
          alive={ready}
          scanning={avatar.status === 'training'}
          rounded="rounded-none"
          className="aspect-[4/3.6] transition-transform duration-700 ease-out-soft group-hover:scale-[1.02]"
        />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <StatusIndicator status={avatar.status === 'draft' ? 'draft' : avatar.status} className="bg-black/50 backdrop-blur-md" />
          {avatar.primary && (
            <span className="inline-flex h-6 items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2 text-[11px] font-medium text-fg backdrop-blur-md">
              <Star className="size-3 fill-current text-warning" aria-hidden /> Primary
            </span>
          )}
        </div>
        {avatar.status === 'training' && (
          <div className="absolute inset-x-4 bottom-4">
            <div className="mb-2 flex justify-between text-[12px] text-fg-muted">
              <span>Learning facial motion…</span>
              <span className="tabular">{avatar.trainingProgress ?? 0}%</span>
            </div>
            <ProgressBar value={avatar.trainingProgress ?? 0} label={`${avatar.name} training progress`} />
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[17px] font-semibold">
              <Link to={href} className="hover:underline hover:decoration-white/30 hover:underline-offset-4">
                {avatar.name}
              </Link>
            </h3>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              {avatar.kind} · {voiceName(avatar.voiceId)}
            </p>
          </div>
          <Menu
            label={`${avatar.name} actions`}
            trigger={(p) => (
              <Button {...p} variant="ghost" size="sm" iconOnly aria-label={`More actions for ${avatar.name}`}>
                <MoreHorizontal />
              </Button>
            )}
            items={[
              { label: 'Open details', icon: <Pencil />, onSelect: () => navigate(href) },
              { label: 'Set as primary', icon: <Star />, disabled: avatar.primary || !ready, onSelect: setPrimary },
              { label: 'Delete avatar', icon: <Trash2 />, danger: true, onSelect: () => setConfirmDelete(true) },
            ]}
          />
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 rounded-[12px] border border-line bg-white/[0.02] p-3 text-center">
          {[
            ['Videos', avatar.usage.videos],
            ['Agents', avatar.usage.agents],
            ['Live', avatar.usage.liveSessions],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] text-fg-subtle">{k}</dt>
              <dd className="tabular mt-0.5 text-[15px] font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-3 text-[12px] text-fg-subtle">Created {formatDate(avatar.createdAt)}</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Button size="sm" variant="secondary" disabled={!ready} onClick={() => navigate(`/create?avatar=${avatar.id}`)} leftIcon={<Clapperboard />} className="px-2">
            Video
          </Button>
          <Button size="sm" variant="secondary" disabled={!ready} onClick={() => navigate(`/live?avatar=${avatar.id}`)} leftIcon={<Radio />} className="px-2">
            Live
          </Button>
          <Button size="sm" variant="secondary" disabled={!ready} onClick={() => navigate(`/agents/new?avatar=${avatar.id}`)} leftIcon={<Bot />} className="px-2">
            Agent
          </Button>
        </div>
      </div>
      <DeleteAvatarDialog avatar={avatar} open={confirmDelete} onClose={() => setConfirmDelete(false)} />
    </article>
  )
}
