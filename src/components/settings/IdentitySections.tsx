import { useEffect, useId, useState } from 'react'
import { Laptop, Plus, Smartphone, Trash2 } from 'lucide-react'
import { api, type AuthSession } from '@/lib/api'
import { useWorkspace } from '@/state/workspace'
import { timeAgo } from '@/lib/format'
import { Badge, Button, Dialog, Field, Input, Select, Skeleton, Slider, Toggle, useToast } from '@/components/ui'
import { AvatarPicker } from '@/components/avatar/AvatarPicker'
import { RowList, SettingsCard, useSave } from './shared'

/* ------------------------------------------------------------ Security */
export function SecuritySection() {
  const toast = useToast()
  const [twoFactor, setTwoFactor] = useState(true)
  const [sessions, setSessions] = useState<AuthSession[] | null>(null)
  const [pwOpen, setPwOpen] = useState(false)
  const { save } = useSave('security')

  useEffect(() => {
    api.listSessions().then(setSessions, () => setSessions([]))
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard title="Security" description="Protect your account and the identities it controls.">
        <div className="flex flex-col gap-6">
          <Toggle
            label="Two-factor authentication"
            description="Require a code from your authenticator app when signing in."
            checked={twoFactor}
            onChange={async (v) => {
              setTwoFactor(v)
              await save({ twoFactor: v }, v ? 'Two-factor authentication is on.' : 'Two-factor authentication is off.')
            }}
          />
          <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="mt-0.5 text-[13px] text-fg-muted">Last changed 3 months ago.</p>
            </div>
            <Button variant="secondary" onClick={() => setPwOpen(true)} className="self-start sm:self-auto">
              Change password
            </Button>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Active sessions" description="Devices currently signed in to your account.">
        {!sessions ? (
          <Skeleton className="h-24" />
        ) : (
          <RowList>
            {sessions.map((s) => {
              const Icon = /iphone|android/i.test(s.device) ? Smartphone : Laptop
              return (
                <li key={s.id} className="flex items-center gap-3 py-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-white/[0.05] text-fg-muted [&_svg]:size-4">
                    <Icon aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[14px] font-medium">
                      <span className="truncate">{s.device}</span>
                      {s.current && <Badge tone="success">This device</Badge>}
                    </p>
                    <p className="text-[12px] text-fg-subtle">
                      {s.location} · {s.current ? 'active now' : timeAgo(s.lastActiveAt)}
                    </p>
                  </div>
                  {!s.current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await api.revokeSession(s.id)
                        setSessions((l) => (l ?? []).filter((x) => x.id !== s.id))
                        toast({ title: 'Session revoked', description: s.device })
                      }}
                    >
                      Revoke
                    </Button>
                  )}
                </li>
              )
            })}
          </RowList>
        )}
      </SettingsCard>
      <PasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  )
}

function PasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const id = useId()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const errs = {
    current: !current ? 'Enter your current password.' : null,
    next: next.length < 10 ? 'Use at least 10 characters.' : next === current ? 'Choose a password you haven’t used here.' : null,
    confirm: confirm !== next ? 'Passwords don’t match.' : null,
  }
  const reset = () => {
    setCurrent('')
    setNext('')
    setConfirm('')
    setTouched(false)
  }
  return (
    <Dialog
      open={open}
      onClose={() => (reset(), onClose())}
      size="sm"
      title="Change password"
      footer={
        <>
          <Button variant="ghost" onClick={() => (reset(), onClose())}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={`${id}-form`} loading={busy}>
            Update password
          </Button>
        </>
      }
    >
      <form
        id={`${id}-form`}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setTouched(true)
          if (errs.current || errs.next || errs.confirm) return
          setBusy(true)
          await api.changePassword({ current, next })
          setBusy(false)
          reset()
          onClose()
          toast({ title: 'Password updated', description: 'Other sessions stay signed in until you revoke them.' })
        }}
      >
        <Field label="Current password" htmlFor={`${id}-c`} error={touched && errs.current}>
          <Input id={`${id}-c`} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} aria-invalid={touched && !!errs.current} />
        </Field>
        <Field label="New password" htmlFor={`${id}-n`} error={touched && errs.next} hint="At least 10 characters.">
          <Input id={`${id}-n`} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={touched && !!errs.next} />
        </Field>
        <Field label="Confirm new password" htmlFor={`${id}-r`} error={touched && errs.confirm}>
          <Input id={`${id}-r`} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={touched && !!errs.confirm} />
        </Field>
      </form>
    </Dialog>
  )
}

/* ------------------------------------------------------------ Avatar */
export function AvatarSettingsSection() {
  const { primaryAvatar } = useWorkspace()
  const [avatarId, setAvatarId] = useState(primaryAvatar?.id ?? '')
  const [watermark, setWatermark] = useState(true)
  const [reverify, setReverify] = useState(true)
  const [consistency, setConsistency] = useState(true)
  const { saving, save } = useSave('avatar', 'Avatar settings saved')
  return (
    <SettingsCard
      title="Avatar settings"
      description="Guardrails for the identities that power your videos, live sessions and agents."
      saving={saving}
      onSubmit={() => save({ defaultAvatarId: avatarId, watermark, reverify, consistency })}
    >
      <div className="max-w-md">
        <AvatarPicker label="Default avatar" value={avatarId} onChange={setAvatarId} />
      </div>
      <div className="mt-6 flex flex-col gap-6 border-t border-line pt-6">
        <Toggle label="Watermark generated videos" description="Adds a subtle “AI-generated” mark to every exported video." checked={watermark} onChange={setWatermark} />
        <Toggle label="Require consent re-verification every 12 months" description="The person behind each digital twin re-confirms consent yearly." checked={reverify} onChange={setReverify} />
        <Toggle label="Identity consistency check" description="Verify every render matches the trained face and voice before delivery." checked={consistency} onChange={setConsistency} />
      </div>
    </SettingsCard>
  )
}

/* ------------------------------------------------------------ Voice */
interface Term {
  id: string
  term: string
  say: string
}

export function VoiceSettingsSection() {
  const { data, primaryAvatar } = useWorkspace()
  const id = useId()
  const voices = data!.voices
  const [voiceId, setVoiceId] = useState(primaryAvatar?.voiceId ?? voices[0]?.id ?? '')
  const [rate, setRate] = useState(1)
  const [terms, setTerms] = useState<Term[]>([
    { id: 't1', term: 'Rooman', say: 'ROO-mun' },
    { id: 't2', term: 'Shalya', say: 'SHULL-yah' },
    { id: 't3', term: 'SaaS', say: 'sass' },
  ])
  const [touched, setTouched] = useState(false)
  const { saving, save } = useSave('voice', 'Voice settings saved')
  const invalid = terms.some((t) => !t.term.trim() || !t.say.trim())
  const update = (tid: string, patch: Partial<Term>) => setTerms((l) => l.map((t) => (t.id === tid ? { ...t, ...patch } : t)))
  const voice = voices.find((v) => v.id === voiceId)

  return (
    <SettingsCard
      title="Voice settings"
      description="How your avatars sound by default."
      saving={saving}
      onSubmit={() => {
        setTouched(true)
        if (invalid) return
        save({ voiceId, rate, pronunciations: terms.map(({ term, say }) => ({ term, say })) })
      }}
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field label="Default voice" htmlFor={`${id}-voice`} hint={voice ? `${voice.kind === 'cloned' ? 'Cloned' : 'Stock'} · ${voice.language} · ${voice.tone}` : undefined}>
          <Select id={`${id}-voice`} value={voiceId} onChange={(e) => setVoiceId(e.target.value)} options={voices.map((v) => ({ value: v.id, label: v.name }))} />
        </Field>
        <Slider label="Speaking rate" value={rate} min={0.75} max={1.5} step={0.05} onChange={setRate} format={(v) => `${v.toFixed(2)}×`} />
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold">Pronunciation dictionary</h3>
            <p className="mt-0.5 text-[13px] text-fg-muted">Teach every voice how to say names and brand terms.</p>
          </div>
          <Button size="sm" leftIcon={<Plus />} onClick={() => setTerms((l) => [...l, { id: `t${Date.now()}`, term: '', say: '' }])}>
            Add term
          </Button>
        </div>
        {terms.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-fg-subtle">No custom pronunciations yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {terms.map((t, i) => (
              <li key={t.id} className="flex items-center gap-2">
                <Input aria-label={`Term ${i + 1}`} placeholder="Term" value={t.term} onChange={(e) => update(t.id, { term: e.target.value })} aria-invalid={touched && !t.term.trim()} />
                <span aria-hidden className="text-fg-subtle">→</span>
                <Input aria-label={`Pronunciation for term ${i + 1}`} placeholder="Say it like…" value={t.say} onChange={(e) => update(t.id, { say: e.target.value })} aria-invalid={touched && !t.say.trim()} />
                <Button variant="ghost" iconOnly aria-label={`Remove ${t.term || `term ${i + 1}`}`} onClick={() => setTerms((l) => l.filter((x) => x.id !== t.id))}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {touched && invalid && (
          <p role="alert" className="mt-2 text-[12px] text-danger">
            Fill in both the term and how to say it, or remove the row.
          </p>
        )}
      </div>
    </SettingsCard>
  )
}
