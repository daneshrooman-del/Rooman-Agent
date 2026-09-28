import { useId, useState } from 'react'
import { useWorkspace } from '@/state/workspace'
import { Field, Input, Select, Toggle } from '@/components/ui'
import { AvatarPicker } from '@/components/avatar/AvatarPicker'
import { EMAIL_RE, initials, RowList, SettingsCard, useSave } from './shared'

/* ------------------------------------------------------------ Profile */
export function ProfileSection() {
  const { data } = useWorkspace()
  const user = data!.user
  const id = useId()
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [touched, setTouched] = useState(false)
  const { saving, save } = useSave('profile', 'Profile updated')
  const nameErr = !name.trim() ? 'Enter your name.' : null
  const emailErr = !EMAIL_RE.test(email.trim()) ? 'Enter a valid email address, like name@company.com.' : null
  const dirty = name !== user.name || email !== user.email

  return (
    <SettingsCard
      title="Profile"
      description="How you appear to teammates across the workspace."
      dirty={dirty}
      saving={saving}
      onSubmit={() => {
        setTouched(true)
        if (nameErr || emailErr) return
        save({ name: name.trim(), email: email.trim() })
      }}
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="flex size-16 items-center justify-center rounded-full bg-[radial-gradient(90%_90%_at_30%_0%,rgb(143_124_255/0.55),#15151d)] text-[20px] font-semibold ring-1 ring-white/10"
        >
          {initials(name)}
        </span>
        <div>
          <p className="text-[15px] font-medium">{name || 'Your name'}</p>
          <p className="text-[13px] text-fg-subtle">Initials are generated from your name.</p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor={`${id}-name`} error={touched && nameErr}>
          <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={touched && !!nameErr} autoComplete="name" />
        </Field>
        <Field label="Email" htmlFor={`${id}-email`} error={touched && emailErr} hint="Used for sign-in and notifications.">
          <Input id={`${id}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={touched && !!emailErr} autoComplete="email" />
        </Field>
        <Field label="Role" htmlFor={`${id}-role`} hint="Only an owner can change workspace roles.">
          <Input id={`${id}-role`} value={user.role} readOnly disabled />
        </Field>
      </div>
    </SettingsCard>
  )
}

/* ------------------------------------------------------------ Workspace */
const languages = ['English', 'Hindi', 'Kannada', 'Spanish', 'Tamil'].map((l) => ({ value: l, label: l }))

export function WorkspaceSection() {
  const { data, primaryAvatar } = useWorkspace()
  const ws = data!.workspace
  const id = useId()
  const [name, setName] = useState(ws.name)
  const [slug, setSlug] = useState(ws.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  const [language, setLanguage] = useState('English')
  const [avatarId, setAvatarId] = useState(primaryAvatar?.id ?? '')
  const [touched, setTouched] = useState(false)
  const { saving, save } = useSave('workspace', 'Workspace updated')
  const nameErr = !name.trim() ? 'Enter a workspace name.' : null
  const slugErr = !/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug) ? 'Use 3–40 lowercase letters, numbers or hyphens.' : null

  return (
    <SettingsCard
      title="Workspace"
      description="Defaults every new video, live session and agent starts from."
      saving={saving}
      onSubmit={() => {
        setTouched(true)
        if (nameErr || slugErr) return
        save({ name, slug, language, defaultAvatarId: avatarId })
      }}
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Workspace name" htmlFor={`${id}-name`} error={touched && nameErr}>
          <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={touched && !!nameErr} />
        </Field>
        <Field label="Workspace URL" htmlFor={`${id}-slug`} error={touched && slugErr} hint={`persona.ai/${slug || 'your-workspace'}`}>
          <Input id={`${id}-slug`} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} aria-invalid={touched && !!slugErr} spellCheck={false} />
        </Field>
        <Field label="Default language" htmlFor={`${id}-lang`} hint="Used for new scripts and agent greetings.">
          <Select id={`${id}-lang`} value={language} onChange={(e) => setLanguage(e.target.value)} options={languages} />
        </Field>
        <div>
          <AvatarPicker label="Default avatar" value={avatarId} onChange={setAvatarId} />
          <p className="mt-2 text-[12px] text-fg-subtle">Preselected in Create Video, Live AI and Agent Builder.</p>
        </div>
      </div>
    </SettingsCard>
  )
}

/* ------------------------------------------------------------ Notifications */
const events = [
  { id: 'videoReady', label: 'Video ready', description: 'When a generated video finishes rendering.' },
  { id: 'trainingComplete', label: 'Avatar training complete', description: 'When a new avatar is ready to use.' },
  { id: 'agentHandoff', label: 'Agent handoff', description: 'When an agent routes a conversation to a person.' },
  { id: 'weeklySummary', label: 'Weekly summary', description: 'Usage and agent performance every Monday.' },
  { id: 'productUpdates', label: 'Product updates', description: 'New features and occasional tips.' },
] as const
type EventId = (typeof events)[number]['id']

export function NotificationsSection() {
  const [prefs, setPrefs] = useState<Record<EventId, { email: boolean; inApp: boolean }>>({
    videoReady: { email: false, inApp: true },
    trainingComplete: { email: true, inApp: true },
    agentHandoff: { email: true, inApp: true },
    weeklySummary: { email: true, inApp: false },
    productUpdates: { email: false, inApp: false },
  })
  const { saving, save } = useSave('notifications', 'Notification preferences saved')
  const set = (id: EventId, ch: 'email' | 'inApp', v: boolean) => setPrefs((p) => ({ ...p, [id]: { ...p[id], [ch]: v } }))

  return (
    <SettingsCard title="Notifications" description="Choose what reaches you, and where." saving={saving} onSubmit={() => save(prefs)}>
      <div className="mb-2 hidden justify-end gap-8 pr-1 text-[12px] font-medium text-fg-subtle sm:flex" aria-hidden>
        <span className="w-12 text-center">Email</span>
        <span className="w-12 text-center">In-app</span>
      </div>
      <RowList>
        {events.map((e) => (
          <li key={e.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[14px] font-medium">{e.label}</p>
              <p className="mt-0.5 text-[13px] text-fg-muted">{e.description}</p>
            </div>
            <div className="flex shrink-0 gap-6 sm:gap-8">
              <ChannelSwitch label="Email" event={e.label} checked={prefs[e.id].email} onChange={(v) => set(e.id, 'email', v)} />
              <ChannelSwitch label="In-app" event={e.label} checked={prefs[e.id].inApp} onChange={(v) => set(e.id, 'inApp', v)} />
            </div>
          </li>
        ))}
      </RowList>
    </SettingsCard>
  )
}

function ChannelSwitch({ label, event, checked, onChange }: { label: string; event: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 sm:w-12 sm:justify-center">
      <span className="text-[12px] text-fg-subtle sm:hidden" aria-hidden>
        {label}
      </span>
      <div className="[&_label]:sr-only [&>div]:gap-0 [&>div>div]:hidden">
        <Toggle label={`${event} — ${label}`} checked={checked} onChange={onChange} />
      </div>
    </div>
  )
}
