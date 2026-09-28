import { useId } from 'react'
import { AudioLines, Languages, Radio, ScanFace, Workflow, Wrench } from 'lucide-react'
import type { Channel } from '@/types'
import { useWorkspace } from '@/state/workspace'
import { Badge } from '@/components/ui/Badge'
import { Field, Select } from '@/components/ui/Form'
import { AvatarPreview } from '@/components/avatar/AvatarPreview'
import { AvatarPicker } from '@/components/avatar/AvatarPicker'
import { channelMeta } from '@/components/agents/channels'
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas'
import { EditableSection, ToggleChip } from './EditableSection'
import { CHANNEL_ORDER, LANGUAGE_OPTIONS } from './templates'
import type { SectionProps } from './ProfileSections'

export function WorkflowSection({ cfg, update, flash }: SectionProps) {
  return (
    <EditableSection
      id="sec-workflow"
      title="Workflow"
      icon={Workflow}
      flashKey={flash('workflow')}
      value={cfg.workflow}
      onSave={(workflow) => update({ workflow }, ['workflow'])}
      renderView={(v) => <WorkflowCanvas nodes={v} animateIn />}
      renderEdit={(d, set) => <WorkflowCanvas nodes={d} onChange={set} editable />}
    />
  )
}

export function ToolsSection({ cfg, update, flash }: SectionProps) {
  return (
    <EditableSection
      id="sec-tools"
      title="Tools"
      icon={Wrench}
      flashKey={flash('tools')}
      value={cfg.tools}
      onSave={(tools) => update({ tools }, ['tools'])}
      renderView={(v) => (
        <div className="flex flex-wrap gap-2">
          {v.map((t) => (
            <ToggleChip key={t.id} on={t.enabled} title={t.description}>
              {t.name}
            </ToggleChip>
          ))}
        </div>
      )}
      renderEdit={(d, set) => (
        <div>
          <p className="mb-3 text-[13px] text-fg-muted">Choose what the agent can use during a conversation.</p>
          <div className="flex flex-wrap gap-2">
            {d.map((t) => (
              <ToggleChip key={t.id} on={t.enabled} title={t.description} onToggle={() => set(d.map((x) => (x.id === t.id ? { ...x, enabled: !x.enabled } : x)))}>
                {t.name}
              </ToggleChip>
            ))}
          </div>
        </div>
      )}
    />
  )
}

export function AvatarSection({ cfg, update, flash }: SectionProps) {
  const { avatarById, voiceName } = useWorkspace()
  const avatar = avatarById(cfg.avatarId)
  return (
    <EditableSection
      id="sec-avatar"
      title="Avatar"
      icon={ScanFace}
      flashKey={flash('avatar')}
      value={cfg.avatarId}
      onSave={(avatarId) => {
        const a = avatarById(avatarId)
        update({ avatarId, voiceId: a?.voiceId ?? cfg.voiceId }, ['avatar', 'voice'])
      }}
      renderView={() => (
        <div className="flex items-center gap-4">
          <AvatarPreview avatar={avatar} alive framing="close" rounded="rounded-[14px]" className="aspect-[4/5] w-[92px] shrink-0 sm:w-[104px]" />
          <div className="min-w-0">
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-fg-subtle">Powered by</p>
            <p className="mt-1 font-display text-[22px] font-semibold tracking-[-0.02em]">{avatar?.name ?? 'No avatar'}</p>
            <p className="text-[13px] text-fg-muted">
              {avatar?.kind} · {voiceName(avatar?.voiceId)}
            </p>
            <p className="mt-2 text-[12px] text-fg-subtle">Same identity as your videos and Live AI.</p>
          </div>
        </div>
      )}
      renderEdit={(d, set) => (
        <div className="flex items-end gap-4">
          <AvatarPreview avatar={avatarById(d)} alive framing="close" rounded="rounded-[14px]" className="aspect-[4/5] w-[80px] shrink-0" />
          <div className="min-w-0 flex-1">
            <AvatarPicker value={d} onChange={set} label="Agent avatar" />
            <p className="mt-2 text-[12px] text-fg-subtle">The avatar’s cloned voice is selected automatically.</p>
          </div>
        </div>
      )}
    />
  )
}

export function VoiceSection({ cfg, update, flash }: SectionProps) {
  const { data } = useWorkspace()
  const id = useId()
  const voices = data?.voices ?? []
  const voice = voices.find((v) => v.id === cfg.voiceId)
  return (
    <EditableSection
      id="sec-voice"
      title="Voice"
      icon={AudioLines}
      flashKey={flash('voice')}
      value={cfg.voiceId}
      onSave={(voiceId) => update({ voiceId }, ['voice'])}
      renderView={() => (
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-10 items-end gap-[3px]">
            {[10, 22, 14, 28, 18, 24, 12].map((h, i) => (
              <span key={i} className="w-[3px] rounded-full bg-accent/70" style={{ height: h }} />
            ))}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
              {voice?.name ?? 'Default voice'}
              {voice?.kind === 'cloned' && <Badge tone="accent">Cloned</Badge>}
            </p>
            <p className="text-[13px] text-fg-muted">
              {voice?.tone} · {voice?.language}
            </p>
          </div>
        </div>
      )}
      renderEdit={(d, set) => (
        <Field label="Voice" htmlFor={id}>
          <Select id={id} value={d} onChange={(e) => set(e.target.value)} options={voices.map((v) => ({ value: v.id, label: `${v.name} — ${v.tone}` }))} />
        </Field>
      )}
    />
  )
}

export function LanguagesSection({ cfg, update, flash }: SectionProps) {
  const options = Array.from(new Set([...cfg.languages, ...LANGUAGE_OPTIONS]))
  return (
    <EditableSection
      id="sec-languages"
      title="Languages"
      icon={Languages}
      flashKey={flash('languages')}
      value={cfg.languages}
      onSave={(languages) => update({ languages: languages.length ? languages : ['English'] }, ['languages'])}
      renderView={(v) => (
        <div className="flex flex-wrap gap-2">
          {v.map((l) => (
            <ToggleChip key={l} on>
              {l}
            </ToggleChip>
          ))}
        </div>
      )}
      renderEdit={(d, set) => (
        <div className="flex flex-wrap gap-2">
          {options.map((l) => (
            <ToggleChip key={l} on={d.includes(l)} onToggle={() => set(d.includes(l) ? d.filter((x) => x !== l) : [...d, l])}>
              {l}
            </ToggleChip>
          ))}
        </div>
      )}
    />
  )
}

export function ChannelsSection({ cfg, update, flash }: SectionProps) {
  const chip = (c: Channel, on: boolean, onToggle?: () => void) => {
    const M = channelMeta[c]
    return (
      <ToggleChip key={c} on={on} onToggle={onToggle} icon={<M.icon aria-hidden />}>
        {c === 'video' ? 'Video' : M.label}
      </ToggleChip>
    )
  }
  return (
    <EditableSection
      id="sec-channels"
      title="Channels"
      icon={Radio}
      flashKey={flash('channels')}
      value={cfg.channels}
      onSave={(channels) => update({ channels: channels.length ? CHANNEL_ORDER.filter((c) => channels.includes(c)) : ['web'] }, ['channels'])}
      renderView={(v) => <div className="flex flex-wrap gap-2">{CHANNEL_ORDER.map((c) => chip(c, v.includes(c)))}</div>}
      renderEdit={(d, set) => (
        <div className="flex flex-wrap gap-2">{CHANNEL_ORDER.map((c) => chip(c, d.includes(c), () => set(d.includes(c) ? d.filter((x) => x !== c) : [...d, c])))}</div>
      )}
    />
  )
}
