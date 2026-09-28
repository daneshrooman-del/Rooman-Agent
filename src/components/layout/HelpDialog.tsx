import { Link } from 'react-router-dom'
import { Dialog } from '@/components/ui/Dialog'

const shortcuts = [
  ['Ctrl / ⌘ K', 'Search everything'],
  ['[', 'Collapse or expand the sidebar'],
  ['Space', 'Play / pause a video'],
  ['Esc', 'Close dialogs and menus'],
]

const flow = [
  ['1', 'Create your avatar', 'Upload a short reference video. Training takes a few minutes.', '/avatars/new'],
  ['2', 'Create videos', 'Describe what your avatar should say or do.', '/create'],
  ['3', 'Go live', 'Talk to the same avatar in real time.', '/live'],
  ['4', 'Build agents', 'Describe a job and deploy an agent that uses your avatar.', '/agents/new'],
] as const

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Help" description="One avatar identity powers every experience in Persona." size="lg">
      <div className="grid gap-6 sm:grid-cols-2">
        <section>
          <h3 className="mb-3 text-[13px] font-medium text-fg-muted">How it fits together</h3>
          <ol className="space-y-2">
            {flow.map(([n, t, d, to]) => (
              <li key={n}>
                <Link to={to} onClick={onClose} className="flex gap-3 rounded-[12px] p-2.5 transition-colors hover:bg-white/[0.05]">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-[11px] text-fg-muted">{n}</span>
                  <span>
                    <span className="block text-[14px] font-medium">{t}</span>
                    <span className="block text-[12px] text-fg-muted">{d}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h3 className="mb-3 text-[13px] font-medium text-fg-muted">Keyboard shortcuts</h3>
          <dl className="space-y-1">
            {shortcuts.map(([k, d]) => (
              <div key={k} className="flex items-center justify-between gap-4 rounded-[10px] px-2.5 py-2">
                <dt className="text-[13px] text-fg-muted">{d}</dt>
                <dd>
                  <kbd className="rounded-md border border-line-strong bg-white/[0.04] px-1.5 py-0.5 text-[11px]">{k}</kbd>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </Dialog>
  )
}
