import { useState, type FormEvent, type ReactNode } from 'react'
import { Bell, Building2, CreditCard, KeyRound, Mic, ScanFace, Shield, User, Users, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import { Button, useToast } from '@/components/ui'

export type SectionId = 'profile' | 'workspace' | 'billing' | 'api-keys' | 'team' | 'notifications' | 'security' | 'avatar' | 'voice'

export const sections: { id: SectionId; label: string; icon: LucideIcon; group: 'Account' | 'Workspace' | 'Identity' }[] = [
  { id: 'profile', label: 'Profile', icon: User, group: 'Account' },
  { id: 'notifications', label: 'Notifications', icon: Bell, group: 'Account' },
  { id: 'security', label: 'Security', icon: Shield, group: 'Account' },
  { id: 'workspace', label: 'Workspace', icon: Building2, group: 'Workspace' },
  { id: 'team', label: 'Team', icon: Users, group: 'Workspace' },
  { id: 'billing', label: 'Billing', icon: CreditCard, group: 'Workspace' },
  { id: 'api-keys', label: 'API keys', icon: KeyRound, group: 'Workspace' },
  { id: 'avatar', label: 'Avatar settings', icon: ScanFace, group: 'Identity' },
  { id: 'voice', label: 'Voice settings', icon: Mic, group: 'Identity' },
]

export const isSectionId = (v: string | null): v is SectionId => !!v && sections.some((s) => s.id === v)

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Saves a section through the API and confirms with a toast. */
export function useSave(section: SectionId, successTitle = 'Changes saved') {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const save = async (values: Record<string, unknown>, description?: string) => {
    setSaving(true)
    try {
      await api.saveSettings(section, values)
      toast({ title: successTitle, description })
      return true
    } catch {
      toast({ title: 'Could not save', description: 'Check your connection and try again.', tone: 'error' })
      return false
    } finally {
      setSaving(false)
    }
  }
  return { saving, save }
}

/** Content panel for one settings section: heading, body and optional save footer. */
export function SettingsCard({
  title,
  description,
  children,
  action,
  onSubmit,
  saving,
  saveLabel = 'Save changes',
  dirty = true,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  action?: ReactNode
  onSubmit?: () => void
  saving?: boolean
  saveLabel?: string
  dirty?: boolean
  className?: string
}) {
  const body = (
    <>
      <div className="flex flex-col gap-4 border-b border-line px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          {description && <p className="mt-1 max-w-xl text-[13px] text-fg-muted">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="px-5 py-6 sm:px-6">{children}</div>
      {onSubmit && (
        <div className="flex justify-end border-t border-line px-5 py-4 sm:px-6">
          <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
            {saveLabel}
          </Button>
        </div>
      )}
    </>
  )
  const cls = cn('surface animate-fade-in overflow-hidden rounded-card shadow-soft', className)
  return onSubmit ? (
    <form
      className={cls}
      noValidate
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      {body}
    </form>
  ) : (
    <section className={cls}>{body}</section>
  )
}

/** Labeled usage meter (credits, storage). */
export function UsageMeter({ label, used, total, format }: { label: string; used: number; total: number; format: (n: number) => string }) {
  const pct = total ? Math.round((used / total) * 100) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="font-medium">{label}</span>
        <span className="tabular text-fg-muted">
          {format(used)} <span className="text-fg-subtle">of {format(total)}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${format(used)} of ${format(total)}`}
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"
      >
        <div className={cn('h-full rounded-full', pct >= 90 ? 'bg-warning' : 'bg-gradient-to-r from-accent to-accent-2')} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-[12px] text-fg-subtle">{pct}% used</p>
    </div>
  )
}

/** A list of settings rows separated by hairlines. */
export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn('-my-1 divide-y divide-line', className)}>{children}</ul>
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || '?'
  )
}
