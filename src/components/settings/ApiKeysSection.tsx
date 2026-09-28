import { useEffect, useId, useState } from 'react'
import { Check, Copy, KeyRound, Plus } from 'lucide-react'
import { api, type ApiKey } from '@/lib/api'
import { useWorkspace } from '@/state/workspace'
import { formatDate, timeAgo } from '@/lib/format'
import { Badge, Button, Dialog, EmptyState, Field, Input, Select, Skeleton, useToast } from '@/components/ui'
import { RowList, SettingsCard } from './shared'

const scopes: { value: ApiKey['scope']; label: string }[] = [
  { value: 'full', label: 'Full access' },
  { value: 'read', label: 'Read only' },
  { value: 'videos', label: 'Videos — generate & fetch' },
  { value: 'agents', label: 'Agents — conversations & embeds' },
]
const scopeLabel = (s: ApiKey['scope']) => scopes.find((x) => x.value === s)?.label.split(' —')[0] ?? s

export function ApiKeysSection() {
  const toast = useToast()
  const [keys, setKeys] = useState<ApiKey[] | null>(null)
  const [error, setError] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [revoking, setRevoking] = useState<ApiKey | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.listApiKeys().then(setKeys, () => setError(true))
  }, [])

  return (
    <SettingsCard
      title="API keys"
      description="Use keys to generate videos, start live sessions and talk to agents from your own product. Keep them secret."
      action={
        <Button variant="primary" leftIcon={<Plus />} onClick={() => setCreateOpen(true)}>
          Create key
        </Button>
      }
    >
      {error ? (
        <p className="text-[14px] text-fg-muted">Keys couldn’t be loaded. Refresh to try again.</p>
      ) : !keys ? (
        <div className="flex flex-col gap-3" aria-label="Loading keys">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <EmptyState compact icon={<KeyRound />} title="No API keys" description="Create a key to call the Persona API from your backend." />
      ) : (
        <RowList>
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate text-[14px] font-medium">{k.name}</p>
                <p className="mt-0.5 text-[12px] text-fg-subtle">
                  Created {formatDate(k.createdAt)} · {k.lastUsedAt ? `last used ${timeAgo(k.lastUsedAt)}` : 'never used'}
                </p>
              </div>
              <code className="tabular rounded-[8px] border border-line bg-white/[0.03] px-2 py-1 font-mono text-[12px] text-fg-muted" aria-label={`Key ending in ${k.last4}`}>
                {k.prefix}_••••{k.last4}
              </code>
              <Badge>{scopeLabel(k.scope)}</Badge>
              <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setRevoking(k)}>
                Revoke
              </Button>
            </li>
          ))}
        </RowList>
      )}

      <CreateKeyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(k) => {
          setKeys((l) => [k, ...(l ?? [])])
          toast({ title: 'API key created', description: k.name })
        }}
      />
      <Dialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        size="sm"
        title="Revoke this key?"
        description={revoking ? `Requests using “${revoking.name}” (${revoking.prefix}_••••${revoking.last4}) will stop working immediately. This can’t be undone.` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevoking(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={busy}
              onClick={async () => {
                if (!revoking) return
                setBusy(true)
                await api.revokeApiKey(revoking.id)
                setKeys((l) => (l ?? []).filter((k) => k.id !== revoking.id))
                setBusy(false)
                toast({ title: 'Key revoked', description: revoking.name })
                setRevoking(null)
              }}
            >
              Revoke key
            </Button>
          </>
        }
      />
    </SettingsCard>
  )
}

function CreateKeyDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (k: ApiKey) => void }) {
  const { isDemo } = useWorkspace()
  const id = useId()
  const [name, setName] = useState('')
  const [scope, setScope] = useState<ApiKey['scope']>('read')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const close = () => {
    onClose()
    // reset after the sheet closes so the secret never flashes on reopen
    setTimeout(() => {
      setName('')
      setScope('read')
      setSecret(null)
      setError(null)
      setCopied(false)
    }, 150)
  }

  const create = async () => {
    if (!name.trim()) return setError('Name the key so you can recognise it later.')
    setBusy(true)
    const res = await api.createApiKey({ name: name.trim(), scope })
    setBusy(false)
    setSecret(res.secret)
    onCreated(res.key)
  }

  const copy = async () => {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
    } catch {
      /* clipboard may be blocked; the key is selectable */
    }
    setCopied(true)
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={secret ? 'Copy your new key' : 'Create API key'}
      description={secret ? 'This is the only time the full key is shown. Store it somewhere safe.' : 'Keys inherit the permissions of the scope you choose.'}
      footer={
        secret ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form={`${id}-form`} loading={busy}>
              Create key
            </Button>
          </>
        )
      }
    >
      {secret ? (
        <div className="flex flex-col gap-3">
          {isDemo && (
            <p className="rounded-[10px] border border-warning/25 bg-warning/[0.07] px-3 py-2 text-[12px] text-warning">Demo key — randomly generated, it won’t authenticate anywhere.</p>
          )}
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 select-all break-all rounded-control border border-line-strong bg-white/[0.04] px-3 py-2.5 font-mono text-[13px]">{secret}</code>
            <Button variant="secondary" iconOnly aria-label={copied ? 'Copied' : 'Copy key'} onClick={copy}>
              {copied ? <Check className="text-success" /> : <Copy />}
            </Button>
          </div>
          <p className="text-[12px] text-fg-subtle" aria-live="polite">
            {copied ? 'Copied to clipboard.' : ' '}
          </p>
        </div>
      ) : (
        <form
          id={`${id}-form`}
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            create()
          }}
        >
          <Field label="Key name" htmlFor={`${id}-name`} error={error} hint="For example “Production website” or “Zapier”.">
            <Input id={`${id}-name`} value={name} autoFocus maxLength={60} aria-invalid={!!error} onChange={(e) => (setName(e.target.value), setError(null))} />
          </Field>
          <Field label="Scope" htmlFor={`${id}-scope`}>
            <Select id={`${id}-scope`} value={scope} onChange={(e) => setScope(e.target.value as ApiKey['scope'])} options={scopes} />
          </Field>
        </form>
      )}
    </Dialog>
  )
}
