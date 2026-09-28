import { useState } from 'react'
import { Rocket } from 'lucide-react'
import type { Agent, Channel } from '@/types'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Toggle } from '@/components/ui/Form'
import { channelMeta } from './channels'

const channelHints: Record<Channel, string> = {
  phone: 'Answers inbound calls on your connected number',
  web: 'Embeddable widget with voice and chat',
  api: 'REST + streaming endpoint for your own apps',
  video: 'Face-to-face calls with the avatar',
  whatsapp: 'Voice notes and chat on WhatsApp Business',
}

export function DeployDialog({ agent, open, onClose, onDeploy }: { agent: Agent; open: boolean; onClose: () => void; onDeploy: (channels: Channel[]) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={`Deploy ${agent.name}`} description="Choose where this agent answers. The same avatar and voice appear on every channel.">
      {open && <DeployForm agent={agent} onClose={onClose} onDeploy={onDeploy} />}
    </Dialog>
  )
}

function DeployForm({ agent, onClose, onDeploy }: { agent: Agent; onClose: () => void; onDeploy: (channels: Channel[]) => void }) {
  const [selected, setSelected] = useState<Channel[]>(agent.channels)
  const all = Object.keys(channelMeta) as Channel[]
  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
        {all.map((c) => {
          const M = channelMeta[c]
          return (
            <li key={c} className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-line-strong bg-white/[0.04] text-fg-muted">
                <M.icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <Toggle
                  label={M.label}
                  description={channelHints[c]}
                  checked={selected.includes(c)}
                  onChange={(v) => setSelected((s) => (v ? [...s, c] : s.filter((x) => x !== c)))}
                />
              </div>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" leftIcon={<Rocket />} disabled={selected.length === 0} onClick={() => onDeploy(all.filter((c) => selected.includes(c)))}>
          Deploy to {selected.length} {selected.length === 1 ? 'channel' : 'channels'}
        </Button>
      </div>
    </div>
  )
}
