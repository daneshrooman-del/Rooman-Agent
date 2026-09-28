import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { useWorkspace } from '@/state/workspace'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useOnline } from '@/hooks/useOnline'
import { useSimulatedJob } from '@/hooks/useSimulatedJob'
import { DemoNote } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useInitialAvatarId } from '@/components/avatar/AvatarPicker'
import { StudioConfigPanel, type StudioSettings } from '@/components/video/StudioConfigPanel'
import { StudioStage, type StudioPhase } from '@/components/video/StudioStage'
import { GeneratingPanel, IdleSummary, ReadyPanel } from '@/components/video/StudioFooters'
import { GenerateBar } from '@/components/video/GenerateBar'
import { useVideoActions } from '@/components/video/useVideoActions'
import { actionLabel, creditCost, estimateDuration, GENERATION_STAGES, PROMPT_MIN, sceneLabel, type VideoDraft } from '@/components/video/studio'

export default function CreateVideoPage() {
  useDocumentTitle('Create video')
  const [params] = useSearchParams()
  const location = useLocation()
  const draft = (location.state ?? null) as VideoDraft | null
  const { data, isDemo, avatarById, voiceName, addVideo, updateVideo, removeVideo } = useWorkspace()
  const online = useOnline()
  const toast = useToast()
  const { share, download } = useVideoActions()
  const initialAvatar = useInitialAvatarId(params.get('avatar'))

  const [s, setS] = useState<StudioSettings>(() => {
    const av = avatarById(initialAvatar)
    return {
      avatarId: initialAvatar,
      voiceId: draft?.voiceId ?? av?.voiceId ?? data?.voices[0]?.id ?? '',
      language: draft?.language ?? av?.languages[0] ?? 'English',
      prompt: draft?.prompt ?? '',
      action: draft?.action ?? 'talk',
      scene: draft?.scene ?? 'studio',
      aspect: draft?.aspect ?? '16:9',
      background: null,
    }
  })
  const [phase, setPhase] = useState<StudioPhase>('idle')
  const [videoId, setVideoId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const job = useSimulatedJob(GENERATION_STAGES.length, { durationMs: 11000 })
  // workspace mutators change identity on every data change — keep a stable handle
  const update = useRef(updateVideo)
  update.current = updateVideo

  const avatar = avatarById(s.avatarId)
  const video = data?.videos.find((v) => v.id === videoId)
  const estimate = estimateDuration(s.prompt, s.action)
  const credits = creditCost(estimate)
  const promptOk = s.prompt.trim().length >= PROMPT_MIN
  const generating = phase === 'generating'

  const bgUrl = useMemo(() => (s.background ? URL.createObjectURL(s.background) : null), [s.background])
  useEffect(() => () => void (bgUrl && URL.revokeObjectURL(bgUrl)), [bgUrl])

  const patch = (p: Partial<StudioSettings>) => {
    setS((prev) => ({ ...prev, ...p }))
    // A visual change after a finished take returns to the live preview (the take stays in the library)
    if (phase === 'ready' && (p.scene || p.aspect || p.avatarId)) setPhase('idle')
  }

  function changeAvatar(id: string) {
    const av = avatarById(id)
    patch({
      avatarId: id,
      voiceId: av?.voiceId ?? s.voiceId,
      language: av?.languages.includes(s.language) ? s.language : (av?.languages[0] ?? s.language),
    })
  }

  // Follow ?avatar= changes while mounted (e.g. "Create video" from another avatar)
  const lastParam = useRef(initialAvatar)
  useEffect(() => {
    if (!initialAvatar || initialAvatar === lastParam.current || generating) return
    lastParam.current = initialAvatar
    changeAvatar(initialAvatar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAvatar])

  // Mirror job progress into the workspace video so the library shows it live
  useEffect(() => {
    if (!videoId || job.state !== 'running') return
    update.current(videoId, { progress: job.progress })
  }, [job.progress, job.state, videoId])

  useEffect(() => {
    if (job.state !== 'done' || !videoId || phase !== 'generating') return
    update.current(videoId, { status: 'ready', progress: 100, durationSec: estimate, consistencyVerified: true })
    setPhase('ready')
    toast({ title: 'Your video is ready', description: `${avatar?.name ?? 'Your avatar'} passed the identity consistency check.` })
  }, [job.state, videoId, phase, estimate, avatar?.name, toast])

  const generate = useCallback(async () => {
    if (!promptOk || !online || submitting) return
    setSubmitting(true)
    try {
      const v = await api.generateVideo({
        avatarId: s.avatarId,
        voiceId: s.voiceId,
        prompt: s.prompt.trim(),
        action: s.action,
        scene: s.scene,
        aspect: s.aspect,
        language: s.language,
      })
      addVideo(v)
      setVideoId(v.id)
      setPhase('generating')
      job.start()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      toast({ title: 'Could not start generation', description: e instanceof Error ? e.message : 'Please try again.', tone: 'error' })
    } finally {
      setSubmitting(false)
    }
  }, [promptOk, online, submitting, s, addVideo, job, toast])

  const cancel = () => {
    job.reset()
    if (videoId) removeVideo(videoId)
    setVideoId(null)
    setPhase('idle')
    toast({ title: 'Generation cancelled', description: 'No credits were used.', tone: 'info' })
  }

  const disabledReason = !online
    ? 'You’re offline — reconnect to generate.'
    : !promptOk
      ? `Describe the video in at least ${PROMPT_MIN} characters to continue.`
      : null

  const summary = [avatar?.name ?? '—', voiceName(s.voiceId), s.language, actionLabel(s.action), sceneLabel(s.scene), s.aspect]
  const creditsLeft = data ? (data.workspace.credits.total - data.workspace.credits.used).toLocaleString() : '—'

  const footer =
    phase === 'generating' ? (
      <GeneratingPanel progress={job.progress} stage={job.stage} onCancel={cancel} />
    ) : phase === 'ready' && video ? (
      <ReadyPanel
        video={video}
        avatarName={avatar?.name}
        onDownload={() => download(video)}
        onShare={() => void share(video)}
        onRegenerate={() => void generate()}
        onNew={() => {
          setPhase('idle')
          setVideoId(null)
        }}
      />
    ) : (
      <IdleSummary items={summary} estimate={`≈ ${estimate}s · ${credits} credits`} />
    )

  return (
    <div className="pb-24 lg:pb-0">
      <header className="mb-5 flex flex-col gap-1 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.14em] text-fg-subtle">Video studio</p>
          <h1 className="text-[28px] font-semibold leading-[1.1] sm:text-[34px]">Create a video</h1>
          <p className="mt-2 text-[15px] text-fg-muted">Direct {avatar?.name ?? 'your avatar'} with a sentence — same face, same voice, every time.</p>
        </div>
        {isDemo && <DemoNote className="mt-2 sm:mt-0">Rendering is simulated in demo mode.</DemoNote>}
      </header>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(380px,420px)_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
        {/* Preview (first on mobile) */}
        <StudioStage
          phase={phase}
          avatar={avatar}
          scene={s.scene}
          aspect={s.aspect}
          backgroundUrl={bgUrl}
          progress={job.progress}
          stageLabel={GENERATION_STAGES[job.stage]}
          video={video}
          footer={footer}
          className="lg:sticky lg:top-[88px] lg:order-2 lg:h-[calc(100dvh-240px)] lg:min-h-[600px]"
        />

        {/* Configuration */}
        <div className="surface flex min-w-0 flex-col rounded-panel lg:sticky lg:top-[88px] lg:order-1 lg:h-[calc(100dvh-240px)] lg:min-h-[600px] lg:overflow-hidden">
          <div className="lg:no-scrollbar min-h-0 flex-1 lg:overflow-y-auto">
            <StudioConfigPanel value={s} onChange={patch} onAvatarChange={changeAvatar} disabled={generating} />
          </div>
          <GenerateBar
            label={generating ? `Generating · ${job.progress}%` : phase === 'ready' ? 'Generate another take' : 'Generate video'}
            hint={generating ? 'Settings are locked while your avatar renders.' : (disabledReason ?? `≈ ${estimate}s video · ${credits} credits`)}
            hintTone={!online ? 'warning' : 'muted'}
            offline={!online}
            disabled={!!disabledReason || generating}
            loading={submitting}
            onGenerate={() => void generate()}
            meta={
              <div className="mb-3 flex items-center justify-between text-[12px] text-fg-subtle">
                <span>Estimated length ≈ {estimate}s</span>
                <span className="tabular">
                  {credits} credits · {creditsLeft} left
                </span>
              </div>
            }
          />
        </div>
      </div>
    </div>
  )
}
