import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, Save, Trash2 } from 'lucide-react'
import type { Agent } from '@/types'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { SectionHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { useAgentActions } from '../useAgentActions'

export function SettingsTab({ agent }: { agent: Agent }) {
  const id = useId()
  const navigate = useNavigate()
  const toast = useToast()
  const { save, markRemoved, logActivity } = useAgentActions(agent)
  const [form, setForm] = useState({ name: agent.name, purpose: agent.purpose, caller: agent.caller, personality: agent.personality })
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState<'delete' | 'archive' | null>(null)
  const [typed, setTyped] = useState('')
  const dirty = (Object.keys(form) as (keyof typeof form)[]).some((k) => form[k] !== agent[k])
  const invalid = !form.name.trim()
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const finish = async (how: 'deleted' | 'archived') => {
    if (how === 'deleted') await api.deleteAgent(agent.id)
    if (how === 'archived') save({ status: 'paused', activity: logActivity('Agent archived', 'edit') })
    markRemoved(how)
    setConfirm(null)
    toast({ title: `${agent.name} ${how}`, description: how === 'deleted' ? 'The agent and its conversation history were removed.' : 'Paused and hidden from your workforce.' })
    navigate('/agents')
  }

  return (
    <div className="flex max-w-3xl flex-col gap-12">
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (invalid) return
          setSaving(true)
          await save({ ...form, name: form.name.trim(), activity: logActivity('Settings updated', 'edit') }, { title: 'Settings saved' })
          setSaving(false)
        }}
      >
        <SectionHeader title="General" description="Identity and behaviour. Changes apply to the next conversation." />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Name" htmlFor={`${id}-n`} error={invalid ? 'Name is required.' : undefined}>
            <Input id={`${id}-n`} value={form.name} onChange={set('name')} aria-invalid={invalid} />
          </Field>
          <Field label="Who calls this agent" htmlFor={`${id}-c`}>
            <Input id={`${id}-c`} value={form.caller} onChange={set('caller')} />
          </Field>
          <Field label="Purpose" htmlFor={`${id}-p`} className="sm:col-span-2">
            <Textarea id={`${id}-p`} value={form.purpose} onChange={set('purpose')} className="min-h-20" />
          </Field>
          <Field label="Personality" htmlFor={`${id}-y`} hint="Tone, pacing and style — e.g. warm, concise, one question at a time." className="sm:col-span-2">
            <Textarea id={`${id}-y`} value={form.personality} onChange={set('personality')} className="min-h-20" />
          </Field>
        </div>
        <div className="mt-6 flex gap-2">
          <Button type="submit" variant="primary" leftIcon={<Save />} loading={saving} disabled={!dirty || invalid}>
            Save settings
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => setForm({ name: agent.name, purpose: agent.purpose, caller: agent.caller, personality: agent.personality })}>
              Discard
            </Button>
          )}
        </div>
      </form>

      <section aria-labelledby={`${id}-danger`} className="rounded-panel border border-danger/20 bg-danger/[0.03]">
        <h2 id={`${id}-danger`} className="px-5 pt-5 text-[15px] font-semibold text-[#ff8a95] sm:px-6">
          Danger zone
        </h2>
        <ul className="mt-3 divide-y divide-danger/10">
          <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-[14px] font-medium">Archive agent</p>
              <p className="text-[13px] text-fg-muted">Stops all channels and hides it from your workforce. History is kept.</p>
            </div>
            <Button variant="secondary" leftIcon={<Archive />} onClick={() => setConfirm('archive')}>
              Archive
            </Button>
          </li>
          <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-[14px] font-medium">Delete agent</p>
              <p className="text-[13px] text-fg-muted">Permanently removes the agent, its workflow and conversation history.</p>
            </div>
            <Button variant="destructive" leftIcon={<Trash2 />} onClick={() => setConfirm('delete')}>
              Delete
            </Button>
          </li>
        </ul>
      </section>

      <Dialog
        open={confirm !== null}
        onClose={() => {
          setConfirm(null)
          setTyped('')
        }}
        size="sm"
        title={confirm === 'delete' ? `Delete ${agent.name}?` : `Archive ${agent.name}?`}
        description={confirm === 'delete' ? 'This cannot be undone. The avatar itself is not affected.' : 'Channels stop immediately. Conversation history is kept.'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            {confirm === 'delete' ? (
              <Button variant="destructive" leftIcon={<Trash2 />} disabled={typed !== agent.name} onClick={() => finish('deleted')}>
                Delete agent
              </Button>
            ) : (
              <Button variant="primary" leftIcon={<Archive />} onClick={() => finish('archived')}>
                Archive agent
              </Button>
            )}
          </>
        }
      >
        {confirm === 'delete' && (
          <Field label={`Type “${agent.name}” to confirm`} htmlFor={`${id}-confirm`}>
            <Input id={`${id}-confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </Field>
        )}
      </Dialog>
    </div>
  )
}
