import { useId } from 'react'
import { Fingerprint, Lock, ShieldCheck, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { Field, Input } from '@/components/ui/Form'
import { ConsentCheckbox } from './ConsentCheckbox'
import { StepHeading } from './StepHeading'

export interface ConsentState {
  identity: boolean
  biometric: boolean
  usage: boolean
  signature: string
}

export const emptyConsent: ConsentState = { identity: false, biometric: false, usage: false, signature: '' }

export const consentComplete = (c: ConsentState) => c.identity && c.biometric && c.usage && c.signature.trim().length >= 3

const points = [
  { icon: Fingerprint, title: 'Used only for this avatar', text: 'Your face and voice are processed to build this identity — nothing else.' },
  { icon: Lock, title: 'Private to your workspace', text: 'Only members of your workspace can use the avatar in videos, live sessions or agents.' },
  { icon: Trash2, title: 'Delete anytime', text: 'Removing the avatar deletes the trained model and your reference footage.' },
]

export function ConsentStep({
  value,
  onChange,
  avatarName,
  focusOnMount,
}: {
  value: ConsentState
  onChange: (v: ConsentState) => void
  avatarName: string
  focusOnMount?: boolean
}) {
  const sigId = useId()
  const set = <K extends keyof ConsentState>(k: K, v: ConsentState[K]) => onChange({ ...value, [k]: v })
  const signed = value.signature.trim().length >= 3

  return (
    <section>
      <StepHeading
        eyebrow="Step 2 · Consent"
        title="Your likeness, your permission"
        description="Before we train an avatar we need your explicit consent. A digital twin can look and sound like a real person, so we only create one with the permission of the person in the video."
        focusOnMount={focusOnMount}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
        <fieldset className="min-w-0">
          <legend className="sr-only">Consent to create {avatarName}</legend>
          <div className="flex flex-col gap-3">
            <ConsentCheckbox
              checked={value.identity}
              onChange={(v) => set('identity', v)}
              title="I am the person in this video, or I have their written authorization."
              description="You may not create an avatar of someone else without documented permission."
            />
            <ConsentCheckbox
              checked={value.biometric}
              onChange={(v) => set('biometric', v)}
              title="I consent to processing of my facial and voice data to create this avatar."
              description="This includes biometric features such as facial geometry, expressions and voice characteristics."
            />
            <ConsentCheckbox
              checked={value.usage}
              onChange={(v) => set('usage', v)}
              title="I understand how the avatar will be used, and that I can delete it and its data at any time."
              description="It can appear in generated videos, live conversations and AI agents in this workspace."
            />
          </div>

          <div className="mt-6 rounded-panel border border-line bg-surface p-5">
            <Field
              label="Type your full legal name to sign"
              htmlFor={sigId}
              hint={`Signed electronically on ${formatDate(new Date().toISOString())}.`}
            >
              <Input
                id={sigId}
                value={value.signature}
                onChange={(e) => set('signature', e.target.value)}
                placeholder="Full name"
                autoComplete="name"
                required
                className="h-12 text-[15px]"
              />
            </Field>
            <div aria-hidden className="mt-4 flex h-16 items-end border-b border-dashed border-line-strong px-1 pb-2">
              <span className={signed ? 'font-display text-[26px] italic tracking-[-0.02em] text-fg animate-fade-in' : 'text-[13px] text-fg-subtle'}>
                {signed ? value.signature : 'Your signature appears here'}
              </span>
            </div>
          </div>
        </fieldset>

        <aside className="min-w-0">
          <div className="rounded-panel border border-line bg-white/[0.02] p-5 lg:sticky lg:top-24">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-[12px] border border-success/25 bg-success/10">
                <ShieldCheck className="size-5 text-success" aria-hidden />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold">How we treat your identity</h2>
                <p className="text-[12px] text-fg-subtle">For “{avatarName}”</p>
              </div>
            </div>
            <ul className="mt-5 flex flex-col gap-4">
              {points.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden />
                  <div>
                    <p className="text-[13px] font-medium">{title}</p>
                    <p className="text-[12px] leading-relaxed text-fg-subtle">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  )
}
