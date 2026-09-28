import { useEffect, useId, useState } from 'react'
import { AudioLines, Check, Play, Save } from 'lucide-react'
import type { Agent } from '@/types'
import { cn } from '@/lib/cn'
import { useWorkspace } from '@/state/workspace'
import { Button } from '@/components/ui/Button'
import { Field, Select, Slider } from '@/components/ui/Form'
import { SectionHeader } from '@/components/ui/PageHeader'
import { useAgentActions } from '../useAgentActions'

const allLanguages = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Spanish', 'French', 'German', 'Arabic']

export function VoiceTab({ agent }: { agent: Agent }) {
  const { data } = useWorkspace()
  const { save } = useAgentActions(agent)
  const id = useId()
  const [voiceId, setVoiceId] = useState(agent.voiceId)
  const [rate, setRate] = useState(1)
  const [expressive, setExpressive] = useState(62)
  const [languages, setLanguages] = useState(agent.languages)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const voices = data?.voices ?? []
  const voice = voices.find((v) => v.id === voiceId)

  useEffect(() => {
    if (!previewing) return
    const t = window.setTimeout(() => setPreviewing(false), 2800)
    return () => window.clearTimeout(t)
  }, [previewing])

  const toggleLang = (l: string) => setLanguages((s) => (s.includes(l) ? (s.length > 1 ? s.filter((x) => x !== l) : s) : [...s, l]))

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
      <div className="flex flex-col gap-8">
        <SectionHeader className="mb-0" title="Voice" description="How the agent sounds on calls, video and web." />
        <Field label="Voice" htmlFor={`${id}-v`} hint={voice ? `${voice.kind === 'cloned' ? 'Cloned voice' : 'Studio voice'} · ${voice.tone}` : undefined}>
          <Select
            id={`${id}-v`}
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            leading={<AudioLines className="size-4 text-fg-subtle" aria-hidden />}
            options={voices.map((v) => ({ value: v.id, label: `${v.name}${v.kind === 'cloned' ? ' (cloned)' : ''} — ${v.language}` }))}
          />
        </Field>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Slider label="Speaking rate" value={rate} onChange={setRate} min={0.7} max={1.4} step={0.05} format={(v) => `${v.toFixed(2)}×`} />
          <Slider label="Expressiveness" value={expressive} onChange={setExpressive} format={(v) => (v < 35 ? 'Calm' : v < 70 ? 'Natural' : 'Animated')} />
        </div>
        <fieldset>
          <legend className="text-[13px] font-medium">Languages</legend>
          <p className="mt-1 text-[12px] text-fg-subtle">The agent detects the caller's language and switches automatically.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {allLanguages.map((l) => {
              const on = languages.includes(l)
              return (
                <button
                  key={l}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleLang(l)}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-all duration-200',
                    on ? 'border-accent/50 bg-accent/12 text-fg' : 'border-line-strong bg-white/[0.02] text-fg-muted hover:border-white/20 hover:text-fg',
                  )}
                >
                  {on && <Check className="size-3.5" aria-hidden />}
                  {l}
                </button>
              )
            })}
          </div>
        </fieldset>
        <div>
          <Button
            variant="primary"
            leftIcon={<Save />}
            loading={saving}
            onClick={async () => {
              setSaving(true)
              await save({ voiceId, languages }, { title: 'Voice settings saved', description: `${voice?.name ?? 'Voice'} · ${languages.join(', ')}` })
              setSaving(false)
            }}
          >
            Save voice
          </Button>
        </div>
      </div>

      <aside className="surface flex flex-col items-center justify-center gap-6 self-start rounded-panel px-6 py-10 text-center" aria-label="Voice preview">
        <div className="flex h-20 items-center gap-[5px]" aria-hidden>
          {Array.from({ length: 28 }).map((_, i) => {
            const base = 18 + Math.round(Math.abs(Math.sin(i * 1.7)) * 58)
            return (
              <span
                key={i}
                className={cn('w-[3px] origin-center rounded-full bg-gradient-to-b from-accent to-accent-2 transition-opacity duration-300', previewing ? 'animate-wave opacity-100' : 'opacity-30')}
                style={{ height: `${previewing ? base : Math.max(10, base * 0.35)}%`, animationDelay: `${(i % 7) * 90}ms`, animationDuration: `${0.9 / rate}s` }}
              />
            )
          })}
        </div>
        <div>
          <p className="text-[15px] font-semibold">{voice?.name ?? 'Voice'}</p>
          <p className="mt-1 max-w-xs text-[13px] text-fg-muted" aria-live="polite">
            {previewing ? `“Hi, I'm the ${agent.name}. How can I help today?”` : 'Hear the voice with your current settings.'}
          </p>
        </div>
        <Button variant="secondary" leftIcon={<Play />} onClick={() => setPreviewing(true)} disabled={previewing}>
          {previewing ? 'Playing…' : 'Preview voice'}
        </Button>
      </aside>
    </div>
  )
}
