import { MessagesSquare, SlidersHorizontal, Wand2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button, TabPanel, Tabs } from '@/components/ui'
import type { AvatarLike } from '@/components/avatar/AvatarPreview'
import { Transcript } from './Transcript'
import { LiveComposer } from './LiveComposer'
import { AgentConfigPanel, type ConfigDraft } from './AgentConfigPanel'
import type { LiveConversation } from './useLiveConversation'

export type SideTab = 'conversation' | 'config'

/** Conversation + Agent configuration panel (desktop side column, mobile sheet). */
export function LiveSidePanel({
  idBase,
  tab,
  onTab,
  conv,
  avatar,
  avatarName,
  micOn,
  config,
  onConfig,
  languages,
  onTurnIntoAgent,
  className,
}: {
  idBase: string
  tab: SideTab
  onTab: (t: SideTab) => void
  conv: LiveConversation
  avatar: AvatarLike
  avatarName: string
  micOn: boolean
  config: ConfigDraft
  onConfig: (patch: Partial<ConfigDraft>) => void
  languages: string[]
  onTurnIntoAgent: () => void
  className?: string
}) {
  return (
    <div className={cn('flex min-h-0 min-w-0 flex-col', className)}>
      <Tabs<SideTab>
        idBase={idBase}
        label="Session panel"
        value={tab}
        onChange={onTab}
        className="mx-0 shrink-0 px-3"
        items={[
          { value: 'conversation', label: 'Conversation', icon: <MessagesSquare aria-hidden />, count: conv.messageCount },
          { value: 'config', label: 'Agent configuration', icon: <SlidersHorizontal aria-hidden /> },
        ]}
      />
      {tab === 'conversation' ? (
        <TabPanel idBase={idBase} value="conversation" className="flex min-h-0 flex-1 flex-col">
          <Transcript
            items={conv.items}
            avatar={avatar}
            avatarName={avatarName}
            className="flex-1"
            empty={<p className="py-10 text-center text-[13px] text-fg-subtle">Say hello — {avatarName} is listening.</p>}
          />
          <div className="shrink-0 border-t border-line p-3 sm:p-4">
            <LiveComposer
              onSend={(t) => conv.send(t)}
              onSpeak={() => conv.speak()}
              listening={conv.phase === 'listening'}
              disabled={!conv.canTalk}
              micDisabled={!micOn}
              placeholder={`Message ${avatarName}`}
              label={`Message ${avatarName}`}
            />
          </div>
        </TabPanel>
      ) : (
        <TabPanel idBase={idBase} value="config" className="min-h-0 flex-1 overflow-y-auto">
          <AgentConfigPanel value={config} onChange={onConfig} avatarName={avatarName} languages={languages} />
        </TabPanel>
      )}
      <div className="shrink-0 border-t border-line p-3 sm:p-4">
        <Button variant="accent" className="w-full" leftIcon={<Wand2 />} onClick={onTurnIntoAgent}>
          Turn this conversation into an agent
        </Button>
      </div>
    </div>
  )
}
