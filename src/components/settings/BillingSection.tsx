import { useState } from 'react'
import { Check, Download, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useWorkspace } from '@/state/workspace'
import { formatBytes, formatDate, formatNumber } from '@/lib/format'
import { Badge, Button, Dialog, useToast } from '@/components/ui'
import { RowList, SettingsCard, UsageMeter, useSave } from './shared'

const plans = [
  { id: 'Starter', price: 29, credits: 2_000, storage: '20 GB', features: ['1 avatar', 'Video generation up to 1080p', '1 live agent'] },
  { id: 'Pro', price: 99, credits: 10_000, storage: '100 GB', features: ['5 avatars', 'Live AI + 5 agents', 'API access & webhooks'] },
  { id: 'Business', price: 399, credits: 50_000, storage: '1 TB', features: ['Unlimited avatars', 'SSO, audit log & roles', 'Priority rendering'] },
]

const monthsAgo = (n: number) => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - n)
  return d.toISOString()
}

export function BillingSection() {
  const { data, isDemo } = useWorkspace()
  const ws = data!.workspace
  const toast = useToast()
  const [plan, setPlan] = useState(ws.plan)
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState(ws.plan)
  const { saving, save } = useSave('billing', 'Plan updated')
  const current = plans.find((p) => p.id === plan) ?? plans[1]
  const invoices = [1, 2, 3].map((n) => ({ id: `INV-2026-0${10 - n}`, date: monthsAgo(n - 1), amount: current.price }))
  const renews = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard
        title="Billing"
        description="Your plan, usage this cycle and invoices."
        action={
          <Button variant="secondary" onClick={() => (setChoice(plan), setOpen(true))}>
            Change plan
          </Button>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-line bg-white/[0.02] p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-[12px] bg-accent-gradient text-white [&_svg]:size-4">
              <Sparkles aria-hidden />
            </span>
            <div>
              <p className="flex items-center gap-2 text-[15px] font-semibold">
                {current.id} plan <Badge tone="accent">Current</Badge>
              </p>
              <p className="text-[13px] text-fg-muted">
                ${current.price}/month · renews {formatDate(renews)}
              </p>
            </div>
          </div>
          <p className="text-[13px] text-fg-subtle">Billed to Visa ending 4242</p>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <UsageMeter label="Credits" used={ws.credits.used} total={Math.max(ws.credits.total, current.credits)} format={formatNumber} />
          <UsageMeter label="Storage" used={ws.storage.usedBytes} total={ws.storage.totalBytes} format={formatBytes} />
        </div>
      </SettingsCard>

      <SettingsCard title="Invoices" description={isDemo ? 'Sample invoices — no charges are made in demo mode.' : 'Download receipts for your records.'}>
        <RowList>
          {invoices.map((inv) => (
            <li key={inv.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="tabular text-[14px] font-medium">{inv.id}</p>
                <p className="text-[12px] text-fg-subtle">{formatDate(inv.date)}</p>
              </div>
              <Badge tone="success">Paid</Badge>
              <span className="tabular w-16 text-right text-[14px]">${inv.amount}.00</span>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label={`Download ${inv.id}`}
                className="size-10 sm:size-8"
                onClick={() => toast({ title: 'Invoice downloading', description: `${inv.id}.pdf` })}
              >
                <Download />
              </Button>
            </li>
          ))}
        </RowList>
      </SettingsCard>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Change plan"
        description="Changes apply immediately; we prorate the difference."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={saving}
              disabled={choice === plan}
              onClick={async () => {
                if (await save({ plan: choice }, `You're now on ${choice}.`)) {
                  setPlan(choice)
                  setOpen(false)
                }
              }}
            >
              {choice === plan ? 'Current plan' : `Switch to ${choice}`}
            </Button>
          </>
        }
      >
        <div role="radiogroup" aria-label="Plans" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {plans.map((p) => {
            const active = choice === p.id
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setChoice(p.id)}
                className={cn(
                  'flex flex-col rounded-[14px] border p-4 text-left transition-all',
                  active ? 'border-accent/50 bg-accent/[0.08] shadow-[0_0_0_3px_rgb(143_124_255/0.12)]' : 'border-line-strong bg-white/[0.02] hover:border-white/20',
                )}
              >
                <span className="flex items-center justify-between text-[14px] font-semibold">
                  {p.id}
                  {p.id === plan && <Badge>Current</Badge>}
                </span>
                <span className="mt-2 text-[24px] font-semibold tracking-tight">
                  ${p.price}
                  <span className="text-[13px] font-normal text-fg-subtle">/mo</span>
                </span>
                <span className="mt-1 text-[12px] text-fg-muted">
                  {formatNumber(p.credits)} credits · {p.storage}
                </span>
                <ul className="mt-4 flex flex-col gap-1.5 text-[12px] text-fg-muted">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>
      </Dialog>
    </div>
  )
}
