import { Code2, Globe, MessageCircle, Phone, Video } from 'lucide-react'
import type { Channel } from '@/types'
import { cn } from '@/lib/cn'

export const channelMeta: Record<Channel, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  phone: { label: 'Phone', icon: Phone },
  web: { label: 'Web', icon: Globe },
  api: { label: 'API', icon: Code2 },
  video: { label: 'Video call', icon: Video },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
}

export function ChannelPills({ channels, className }: { channels: Channel[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)} aria-label="Channels">
      {channels.map((c) => {
        const M = channelMeta[c]
        return (
          <li key={c} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-white/[0.03] px-2.5 text-[12px] text-fg-muted">
            <M.icon className="size-3.5" aria-hidden />
            {M.label}
          </li>
        )
      })}
    </ul>
  )
}
