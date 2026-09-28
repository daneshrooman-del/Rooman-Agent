import { cn } from '@/lib/cn'
import { sections, type SectionId } from './shared'

/** Vertical grouped nav on desktop; horizontally scrolling pills on mobile. */
export function SettingsNav({ value, onChange }: { value: SectionId; onChange: (id: SectionId) => void }) {
  const groups = ['Account', 'Workspace', 'Identity'] as const
  return (
    <nav aria-label="Settings sections">
      {/* mobile */}
      <ul className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
        {sections.map((s) => {
          const active = s.id === value
          return (
            <li key={s.id} className="snap-start shrink-0">
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onChange(s.id)}
                className={cn(
                  'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition-colors [&_svg]:size-4',
                  active ? 'border-accent/40 bg-accent/12 text-fg' : 'border-line-strong bg-white/[0.02] text-fg-muted hover:text-fg',
                )}
              >
                <s.icon aria-hidden />
                {s.label}
              </button>
            </li>
          )
        })}
      </ul>
      {/* desktop */}
      <div className="hidden flex-col gap-6 lg:flex">
        {groups.map((g) => (
          <div key={g}>
            <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">{g}</p>
            <ul className="flex flex-col gap-0.5">
              {sections
                .filter((s) => s.group === g)
                .map((s) => {
                  const active = s.id === value
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        aria-current={active ? 'page' : undefined}
                        onClick={() => onChange(s.id)}
                        className={cn(
                          'flex h-10 w-full items-center gap-3 rounded-control px-3 text-left text-[14px] transition-colors [&_svg]:size-4',
                          active ? 'bg-white/[0.07] font-medium text-fg' : 'text-fg-muted hover:bg-white/[0.04] hover:text-fg',
                        )}
                      >
                        <s.icon aria-hidden className={active ? 'text-accent' : 'text-fg-subtle'} />
                        {s.label}
                      </button>
                    </li>
                  )
                })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}
