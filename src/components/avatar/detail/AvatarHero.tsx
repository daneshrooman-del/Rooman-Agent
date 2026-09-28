import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bot, CalendarDays, Clapperboard, Copy, Languages, Mic, MoreHorizontal, Radio, RefreshCw, Star, Trash2 } from 'lucide-react'
import type { Avatar } from '@/types'
import { formatDate } from '@/lib/format'
import { useWorkspace } from '@/state/workspace'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { ProgressBar } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { AvatarPreview } from '@/components/avatar/AvatarPreview'
import { IdentityPanel } from './IdentityPanel'
import { DeleteAvatarDialog } from '@/components/avatar/DeleteAvatarDialog'

export function AvatarHero({ avatar }: { avatar: Avatar }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()
  const { data, voiceName, updateAvatar } = useWorkspace()
  const ready = avatar.status === 'ready'
  const training = avatar.status === 'training'
  const failed = avatar.status === 'failed'
  const progress = avatar.trainingProgress ?? 0

  const setPrimary = () => {
    data?.avatars.forEach((a) => a.primary && a.id !== avatar.id && updateAvatar(a.id, { primary: false }))
    updateAvatar(avatar.id, { primary: true })
    toast({ title: `${avatar.name} is now your primary avatar`, description: 'New videos, live sessions and agents will default to it.' })
  }

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(avatar.id)
      toast({ title: 'Avatar ID copied', description: avatar.id })
    } catch {
      toast({ title: 'Couldn’t access the clipboard', description: avatar.id, tone: 'error' })
    }
  }

  const meta = [
    { icon: Mic, text: voiceName(avatar.voiceId) },
    { icon: Languages, text: avatar.languages.join(' · ') },
    { icon: CalendarDays, text: `Created ${formatDate(avatar.createdAt)}` },
  ]

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
      <div className="relative animate-fade-up">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-3 rounded-full opacity-60 lg:-inset-8 blur-3xl"
          style={{ background: `radial-gradient(50% 50% at 50% 40%, hsl(${avatar.hue} 80% 55% / 0.3), transparent 70%)` }}
        />
        <AvatarPreview
          avatar={avatar}
          alive={ready}
          scanning={training}
          rounded="rounded-hero"
          className="relative aspect-[4/4.2] w-full border border-white/[0.08] shadow-[0_40px_120px_-40px_rgb(0_0_0/0.9)] sm:aspect-[4/4.6]"
        >
          {training && (
            <div className="glass-strong absolute inset-x-4 bottom-4 rounded-[14px] p-4 sm:inset-x-6 sm:bottom-6" aria-live="polite">
              <div className="mb-2.5 flex justify-between text-[13px]">
                <span className="font-medium">Learning facial motion…</span>
                <span className="tabular text-fg-muted">{progress}%</span>
              </div>
              <ProgressBar value={progress} label={`${avatar.name} training progress`} />
            </div>
          )}
        </AvatarPreview>
      </div>

      <div className="flex min-w-0 flex-col justify-center">
        <div className="animate-fade-up" style={{ animationDelay: '60ms' }}>
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-fg-subtle">{avatar.kind}</p>
          <h1 className="mt-3 text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[60px]">{avatar.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusIndicator status={avatar.status} />
            {avatar.primary && (
              <span className="inline-flex h-6 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 text-[12px] font-medium">
                <Star className="size-3 fill-current text-warning" aria-hidden /> Primary identity
              </span>
            )}
          </div>
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-fg-muted">
            {meta.map(({ icon: Icon, text }) => (
              <li key={text} className="inline-flex items-center gap-2">
                <Icon className="size-4 text-fg-subtle" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>

        {training && (
          <p className="mt-6 rounded-card border border-accent/20 bg-accent/[0.06] px-4 py-3 text-[13px] text-fg-muted">
            <span className="font-medium text-fg">Training in progress.</span> Videos, live sessions and agents unlock as soon as {avatar.name} is ready — you can leave this page.
          </p>
        )}
        {failed && (
          <div className="mt-6 flex flex-col gap-3 rounded-card border border-danger/25 bg-danger/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-[13px] text-fg-muted">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
              Training failed — the footage may be too dark or the face was not visible long enough.
            </p>
            <Button size="sm" variant="secondary" leftIcon={<RefreshCw aria-hidden />} onClick={() => navigate('/avatars/new')}>
              Retrain
            </Button>
          </div>
        )}

        <div className="mt-7 flex flex-wrap gap-2 animate-fade-up" style={{ animationDelay: '120ms' }}>
          <Button variant="accent" size="lg" disabled={!ready} leftIcon={<Clapperboard aria-hidden />} onClick={() => navigate(`/create?avatar=${avatar.id}`)} className="grow sm:grow-0">
            Generate Video
          </Button>
          <Button variant="secondary" size="lg" disabled={!ready} leftIcon={<Radio aria-hidden />} onClick={() => navigate(`/live?avatar=${avatar.id}`)} className="grow sm:grow-0">
            Go Live
          </Button>
          <Button variant="secondary" size="lg" disabled={!ready} leftIcon={<Bot aria-hidden />} onClick={() => navigate(`/agents/new?avatar=${avatar.id}`)} className="grow sm:grow-0">
            Use in Agent
          </Button>
          <Menu
            label={`${avatar.name} actions`}
            trigger={(p) => (
              <Button {...p} variant="secondary" size="lg" iconOnly aria-label={`More actions for ${avatar.name}`}>
                <MoreHorizontal />
              </Button>
            )}
            items={[
              { label: 'Set as primary', icon: <Star />, disabled: avatar.primary || !ready, onSelect: setPrimary },
              { label: 'Copy avatar ID', icon: <Copy />, onSelect: copyId },
              { label: 'Retrain with new footage', icon: <RefreshCw />, onSelect: () => navigate('/avatars/new') },
              { label: 'Delete avatar', icon: <Trash2 />, danger: true, onSelect: () => setConfirmDelete(true) },
            ]}
          />
        </div>

        <div className="mt-8 animate-fade-up" style={{ animationDelay: '180ms' }}>
          <IdentityPanel avatar={avatar} />
        </div>
      </div>
      <DeleteAvatarDialog avatar={avatar} open={confirmDelete} onClose={() => setConfirmDelete(false)} onDeleted={() => navigate('/avatars')} />
    </section>
  )
}
