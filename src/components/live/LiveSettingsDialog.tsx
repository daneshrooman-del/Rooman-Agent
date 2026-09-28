import { useId } from 'react'
import { useWorkspace } from '@/state/workspace'
import { Button, Dialog, Field, SegmentedControl, Select, Toggle } from '@/components/ui'
import type { ResponseStyle } from './liveScript'

export interface LiveSettings {
  voiceId: string
  language: string
  style: ResponseStyle
  captions: boolean
}

export function LiveSettingsDialog({
  open,
  onClose,
  value,
  onChange,
  languages,
}: {
  open: boolean
  onClose: () => void
  value: LiveSettings
  onChange: (patch: Partial<LiveSettings>) => void
  languages: string[]
}) {
  const { data } = useWorkspace()
  const voiceId = useId()
  const langId = useId()
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Session settings"
      description="Changes apply from the next reply."
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}
    >
      <div className="flex flex-col gap-5">
        <Field label="Voice" htmlFor={voiceId}>
          <Select
            id={voiceId}
            value={value.voiceId}
            onChange={(e) => onChange({ voiceId: e.target.value })}
            options={(data?.voices ?? []).map((v) => ({ value: v.id, label: `${v.name} · ${v.tone}` }))}
          />
        </Field>
        <Field label="Language" htmlFor={langId}>
          <Select id={langId} value={value.language} onChange={(e) => onChange({ language: e.target.value })} options={languages.map((l) => ({ value: l, label: l }))} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium">Response style</span>
          <SegmentedControl<ResponseStyle>
            label="Response style"
            value={value.style}
            onChange={(style) => onChange({ style })}
            options={[
              { value: 'concise', label: 'Concise' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'detailed', label: 'Detailed' },
            ]}
            className="w-full"
          />
        </div>
        <Toggle checked={value.captions} onChange={(captions) => onChange({ captions })} label="Captions" description="Show what the avatar says on the stage." />
      </div>
    </Dialog>
  )
}
