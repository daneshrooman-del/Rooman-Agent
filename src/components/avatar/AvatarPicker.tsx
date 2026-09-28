import { useId } from 'react'
import { useWorkspace } from '@/state/workspace'
import { Field, Select } from '@/components/ui/Form'
import { AvatarChip } from './AvatarPreview'

/** Avatar selector used by Create Video, Live AI and Agent Builder. Only ready avatars are selectable. */
export function AvatarPicker({ value, onChange, label = 'Avatar' }: { value: string; onChange: (id: string) => void; label?: string }) {
  const { data, avatarById } = useWorkspace()
  const id = useId()
  const ready = (data?.avatars ?? []).filter((a) => a.status === 'ready')
  return (
    <Field label={label} htmlFor={id}>
      <Select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        leading={<AvatarChip avatar={avatarById(value)} size={22} />}
        options={ready.map((a) => ({ value: a.id, label: `${a.name} — ${a.kind}` }))}
      />
    </Field>
  )
}

/** Resolve the avatar to preselect from ?avatar= or fall back to the primary one. */
export function useInitialAvatarId(param: string | null) {
  const { avatarById, primaryAvatar } = useWorkspace()
  const a = avatarById(param ?? undefined)
  return a && a.status === 'ready' ? a.id : (primaryAvatar?.id ?? '')
}
