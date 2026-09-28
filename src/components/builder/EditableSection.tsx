import { useEffect, useState, type ReactNode } from 'react'
import { Pencil, Plus, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'

/** A generated configuration section with inline edit mode (Save / Cancel). */
export function EditableSection<T>({
  id,
  title,
  icon: Icon,
  hint,
  value,
  onSave,
  renderView,
  renderEdit,
  flashKey,
  className,
  editable = true,
}: {
  id: string
  title: string
  icon: LucideIcon
  hint?: ReactNode
  value: T
  onSave: (v: T) => void
  renderView: (v: T) => ReactNode
  renderEdit?: (draft: T, setDraft: (v: T) => void) => ReactNode
  /** changes to this number (when non-zero) trigger a brief "Updated" highlight */
  flashKey?: number
  className?: string
  editable?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (!flashKey) return
    setFlash(true)
    const t = window.setTimeout(() => setFlash(false), 2400)
    return () => window.clearTimeout(t)
  }, [flashKey])

  const headingId = `${id}-title`
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'relative animate-fade-up rounded-card border bg-surface/80 p-5 transition-[border-color,box-shadow] duration-700 sm:p-6',
        editing ? 'border-accent/35 shadow-[0_0_0_4px_rgb(143_124_255/0.06)]' : flash ? 'border-accent/45 shadow-[0_0_0_4px_rgb(143_124_255/0.1),0_0_40px_-10px_rgb(143_124_255/0.5)]' : 'border-line',
        className,
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-line bg-white/[0.03] text-fg-muted">
            <Icon className="size-3.5" />
          </span>
          <h3 id={headingId} className="text-[14px] font-semibold tracking-[-0.01em]">
            {title}
          </h3>
          {flash && !editing && <span className="animate-fade-in text-[11px] font-medium text-[#c6bcff]">Updated</span>}
        </div>
        {editable && renderEdit && !editing && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Pencil aria-hidden />}
            aria-label={`Edit ${title}`}
            onClick={() => {
              setDraft(value)
              setEditing(true)
            }}
            className="-mr-2 -mt-1"
          >
            Edit
          </Button>
        )}
      </header>

      {editing && renderEdit ? (
        <div className="animate-fade-in">
          {renderEdit(draft, setDraft)}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onSave(draft)
                setEditing(false)
              }}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        renderView(value)
      )}
      {hint && !editing && <div className="mt-4 text-[12px] text-fg-subtle">{hint}</div>}
    </section>
  )
}

/** Editable list of short strings (goals, guardrails, sources). */
export function ListEditor({ items, onChange, label, placeholder }: { items: string[]; onChange: (v: string[]) => void; label: string; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            aria-label={`${label} ${i + 1}`}
            value={it}
            placeholder={placeholder}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <Button variant="ghost" iconOnly aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <X aria-hidden />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="self-start" leftIcon={<Plus aria-hidden />} onClick={() => onChange([...items, ''])}>
        Add {label.toLowerCase()}
      </Button>
    </div>
  )
}

/** Pill toggle (aria-pressed) used for tools, languages and channels. */
export function ToggleChip({
  on,
  onToggle,
  children,
  icon,
  disabled,
  title,
}: {
  on: boolean
  onToggle?: () => void
  children: ReactNode
  icon?: ReactNode
  disabled?: boolean
  title?: string
}) {
  const cls = cn(
    'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-all duration-200 [&_svg]:size-3.5',
    on ? 'border-accent/40 bg-accent/10 text-fg' : 'border-line bg-white/[0.015] text-fg-subtle',
  )
  if (!onToggle) {
    return (
      <span className={cls} title={title}>
        {icon}
        {children}
      </span>
    )
  }
  return (
    <button type="button" aria-pressed={on} disabled={disabled} title={title} onClick={onToggle} className={cn(cls, 'hover:border-white/20 hover:text-fg')}>
      {icon}
      {children}
      <span aria-hidden className={cn('ml-0.5 size-1.5 rounded-full', on ? 'bg-accent' : 'bg-white/15')} />
    </button>
  )
}
