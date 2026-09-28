import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Info } from 'lucide-react'
import type { Avatar } from '@/types'
import { api } from '@/lib/api'
import { useWorkspace } from '@/state/workspace'
import { useSimulatedJob } from '@/hooks/useSimulatedJob'
import { DemoNote, ErrorState, ProgressBar, StageList } from '@/components/ui/States'
import type { ReferenceSource } from './ReferencePreview'
import { StepHeading } from './StepHeading'
import { TrainingStage } from './TrainingStage'
import { startTraining, stopTraining } from './trainingRunner'

export const TRAINING_STAGES = ['Analyzing video', 'Extracting identity', 'Learning facial motion', 'Preparing voice', 'Creating avatar']
const DURATION_MS = 10_000

/** Invert the job's ease-out curve so we can show honest elapsed / remaining time. */
const elapsedFor = (progress: number) => (1 - Math.pow(1 - progress / 100, 1 / 1.6)) * DURATION_MS
const secs = (ms: number) => `${Math.max(0, Math.round(ms / 1000))}s`

export function ProcessingStep({
  name,
  source,
  onDone,
  focusOnMount,
}: {
  name: string
  source: ReferenceSource
  onDone: (avatar: Avatar) => void
  focusOnMount?: boolean
}) {
  const { addAvatar, updateAvatar, isDemo } = useWorkspace()
  const job = useSimulatedJob(TRAINING_STAGES.length, { durationMs: DURATION_MS })
  const [avatar, setAvatar] = useState<Avatar | null>(null)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)
  const finished = useRef(false)
  const doneTimer = useRef<number | undefined>(undefined)
  const { start } = job

  const begin = useCallback(() => {
    setError(null)
    api
      .createAvatar({ name: name.trim(), file: source.kind === 'file' ? source.file : null, consent: true })
      .then((a) => {
        setAvatar(a)
        addAvatar(a)
        startTraining(a.id, DURATION_MS, updateAvatar)
        start()
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Upload failed'))
  }, [name, source, start, addAvatar, updateAvatar])

  useEffect(() => {
    if (started.current) return
    started.current = true
    begin()
  }, [begin])

  useEffect(() => {
    if (job.state !== 'done' || !avatar || finished.current) return
    finished.current = true
    stopTraining(avatar.id)
    const ready: Partial<Avatar> = { status: 'ready', trainingProgress: 100 }
    updateAvatar(avatar.id, ready)
    doneTimer.current = window.setTimeout(() => onDone({ ...avatar, ...ready }), 900)
  }, [job.state, avatar, updateAvatar, onDone])

  useEffect(() => () => window.clearTimeout(doneTimer.current), [])

  if (error) {
    return (
      <div className="mx-auto max-w-xl pt-6">
        <h1 className="sr-only">Avatar upload failed</h1>
        <ErrorState title="We couldn’t start training" description={`${error}. Your consent and settings are saved — try again.`} onRetry={begin} />
      </div>
    )
  }

  const done = job.state === 'done'
  const elapsed = elapsedFor(job.progress)
  const label = done ? 'Avatar created' : TRAINING_STAGES[job.stage]

  return (
    <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
      <TrainingStage avatar={{ hue: avatar?.hue ?? 258, name }} scanning={!done} alive className="mx-auto w-full max-w-[340px] sm:max-w-[520px] animate-fade-up">
        <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3 sm:inset-x-7 sm:bottom-7">
          <div className="glass-strong min-w-0 rounded-[12px] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-fg-subtle">{done ? 'Complete' : `Stage ${job.stage + 1} of ${TRAINING_STAGES.length}`}</p>
            <p className="truncate text-[13px] font-medium">{label}</p>
          </div>
          <span className="glass-strong tabular rounded-[12px] px-3 py-2 text-[20px] font-semibold">{job.progress}%</span>
        </div>
      </TrainingStage>

      <div className="min-w-0">
        <StepHeading
          eyebrow="Step 3 · Training"
          title="Creating your digital twin..."
          description={`We're learning how ${name.trim() || 'your avatar'} looks, moves and sounds. This keeps running if you leave.`}
          focusOnMount={focusOnMount}
        />

        <div className="mt-8" aria-live="polite">
          <div className="flex items-end justify-between gap-4">
            <span className="tabular text-gradient text-[56px] font-semibold leading-none tracking-[-0.04em]">{job.progress}%</span>
            <span className="tabular pb-1 text-right text-[12px] text-fg-subtle">
              Elapsed {secs(elapsed)}
              <br />
              {done ? 'Finishing up' : `About ${secs(DURATION_MS - elapsed)} remaining`}
            </span>
          </div>
          <ProgressBar value={job.progress} label="Avatar training progress" className="mt-4 h-2" />
        </div>

        <div className="mt-6 rounded-panel border border-line bg-white/[0.02] p-2">
          <StageList stages={TRAINING_STAGES} current={job.state === 'idle' ? 0 : job.stage} done={done} />
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-card border border-line bg-surface px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2.5 text-[13px] text-fg-muted">
            <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
            You can leave this page — training continues and we’ll mark it ready in My Avatars.
          </p>
          <Link to="/avatars" className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-fg hover:text-accent">
            My Avatars <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        {isDemo && <DemoNote className="mt-5">Training is simulated and accelerated in demo mode.</DemoNote>}
      </div>
    </section>
  )
}
