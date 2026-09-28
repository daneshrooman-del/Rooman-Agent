import { useId, useState } from 'react'
import type { Agent } from '@/types'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Textarea } from '@/components/ui/Form'

export function QuickEditDialog({ agent, open, onClose, onSave }: { agent: Agent; open: boolean; onClose: () => void; onSave: (p: Pick<Agent, 'name' | 'purpose'>) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Quick edit" description="Rename the agent or sharpen its purpose.">
      {open && <Form agent={agent} onClose={onClose} onSave={onSave} />}
    </Dialog>
  )
}

function Form({ agent, onClose, onSave }: { agent: Agent; onClose: () => void; onSave: (p: Pick<Agent, 'name' | 'purpose'>) => void }) {
  const id = useId()
  const [name, setName] = useState(agent.name)
  const [purpose, setPurpose] = useState(agent.purpose)
  const invalid = !name.trim()
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!invalid) onSave({ name: name.trim(), purpose: purpose.trim() })
      }}
    >
      <Field label="Agent name" htmlFor={`${id}-n`} error={invalid ? 'Give the agent a name.' : undefined}>
        <Input id={`${id}-n`} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={invalid} autoFocus />
      </Field>
      <Field label="Purpose" htmlFor={`${id}-p`} hint="One or two sentences. Shown to your team and used to steer the agent.">
        <Textarea id={`${id}-p`} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={invalid}>
          Save changes
        </Button>
      </div>
    </form>
  )
}
