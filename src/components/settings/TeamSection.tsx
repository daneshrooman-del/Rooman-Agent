import { useEffect, useId, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { api, type TeamMember, type TeamRole } from '@/lib/api'
import { Badge, Button, Dialog, Field, Input, Select, Skeleton, useToast } from '@/components/ui'
import { EMAIL_RE, initials, RowList, SettingsCard } from './shared'

const roles: { value: TeamRole; label: string; hint: string }[] = [
  { value: 'Admin', label: 'Admin', hint: 'Manage members, billing and keys' },
  { value: 'Editor', label: 'Editor', hint: 'Create avatars, videos and agents' },
  { value: 'Recruiter', label: 'Recruiter', hint: 'Handle agent handoffs and candidates' },
  { value: 'Viewer', label: 'Viewer', hint: 'View content and analytics' },
]

export function TeamSection() {
  const toast = useToast()
  const [members, setMembers] = useState<TeamMember[] | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  useEffect(() => {
    api.listTeam().then(setMembers, () => setMembers([]))
  }, [])

  const changeRole = async (m: TeamMember, role: TeamRole) => {
    setMembers((l) => (l ?? []).map((x) => (x.id === m.id ? { ...x, role } : x)))
    await api.updateMemberRole(m.id, role)
    toast({ title: 'Role updated', description: `${m.name} is now ${role === 'Admin' ? 'an' : 'a'} ${role}.` })
  }

  return (
    <SettingsCard
      title="Team"
      description="Invite teammates and decide what they can do."
      action={
        <Button variant="primary" leftIcon={<UserPlus />} onClick={() => setInviteOpen(true)}>
          Invite
        </Button>
      }
    >
      {!members ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : (
        <RowList>
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-3.5">
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[12px] font-semibold ring-1 ring-white/10">
                {initials(m.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-[14px] font-medium">
                  {m.name}
                  {m.status === 'invited' && <Badge tone="info">Invited</Badge>}
                </p>
                <p className="truncate text-[12px] text-fg-subtle">{m.email}</p>
              </div>
              {m.role === 'Owner' ? (
                <span className="w-28 shrink-0 pr-3 text-right text-[13px] text-fg-muted sm:w-40">Owner</span>
              ) : (
                <Select
                  aria-label={`Role for ${m.name}`}
                  value={m.role}
                  onChange={(e) => changeRole(m, e.target.value as TeamRole)}
                  options={roles}
                  className="w-32 shrink-0 sm:w-40"
                />
              )}
            </li>
          ))}
        </RowList>
      )}
      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        existing={members?.map((m) => m.email) ?? []}
        onInvited={(m) => {
          setMembers((l) => [...(l ?? []), m])
          toast({ title: 'Invite sent', description: `${m.email} will join as ${m.role}.` })
        }}
      />
    </SettingsCard>
  )
}

function InviteDialog({ open, onClose, existing, onInvited }: { open: boolean; onClose: () => void; existing: string[]; onInvited: (m: TeamMember) => void }) {
  const id = useId()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('Editor')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const v = email.trim().toLowerCase()
    if (!EMAIL_RE.test(v)) return setError('Enter a valid email address, like name@company.com.')
    if (existing.includes(v)) return setError('This person is already on the team.')
    setBusy(true)
    const m = await api.inviteMember({ email: v, role })
    setBusy(false)
    onInvited(m)
    setEmail('')
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite a teammate"
      description="They’ll get an email with a link to join this workspace."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={`${id}-form`} loading={busy}>
            Send invite
          </Button>
        </>
      }
    >
      <form
        id={`${id}-form`}
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label="Email" htmlFor={`${id}-email`} error={error}>
          <Input id={`${id}-email`} type="email" autoFocus value={email} aria-invalid={!!error} placeholder="name@company.com" onChange={(e) => (setEmail(e.target.value), setError(null))} />
        </Field>
        <Field label="Role" htmlFor={`${id}-role`} hint={roles.find((r) => r.value === role)?.hint}>
          <Select id={`${id}-role`} value={role} onChange={(e) => setRole(e.target.value as TeamRole)} options={roles} />
        </Field>
      </form>
    </Dialog>
  )
}
