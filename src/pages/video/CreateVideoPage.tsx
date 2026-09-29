import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { engine, engineEnabled, engineSupports, engineSupportsLanguage } from '@/lib/avatarEngine'
import { useWorkspace } from '@/state/workspace'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useOnline } from '@/hooks/useOnline'
import { useSimulatedJob } from '@/hooks/useSimulatedJob'
import { DemoNote } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useInitialAvatarId } from '@/components/avatar/AvatarPicker'
import { useObjectUrl } from '@/components/avatar/onboarding/useObjectUrl'
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
  // Real render via the avatar engine (only for twins it trained); demo avatars keep the simulation.
  const enginePoll = useRef<number | undefined>(undefined)
  const [engineRun, setEngineRun] = useState(false)
  useEffect(() => () => window.clearInterval(enginePoll.current), [])

  const avatar = avatarById(s.avatarId)
  const video = data?.videos.find((v) => v.id === videoId)
  // real twins speak the script verbatim (~2.5 words/s); demo avatars use the directed-video estimate
  const estimate = avatar?.engine ? Math.max(2, Math.round(s.prompt.trim().split(/\s+/).filter(Boolean).length / 2.5)) : estimateDuration(s.prompt, s.action)
  const credits = creditCost(estimate)
  const promptOk = s.prompt.trim().length >= PROMPT_MIN
  const generating = phase === 'generating'

  const bgUrl = useObjectUrl(s.background)

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
    if (!videoId || job.state !== 'running' || engineRun) return
    update.current(videoId, { progress: job.progress })
  }, [job.progress, job.state, videoId, engineRun])

  useEffect(() => {
    if (job.state !== 'done' || !videoId || phase !== 'generating' || engineRun) return
    update.current(videoId, { status: 'ready', progress: 100, durationSec: estimate, consistencyVerified: true })
    setPhase('ready')
    toast({ title: 'Your video is ready', description: `${avatar?.name ?? 'Your avatar'} passed the identity consistency check.` })
  }, [job.state, videoId, phase, estimate, avatar?.name, toast, engineRun])

  /** Real render: the engine speaks the script in the twin's cloned voice and animates the twin. */
  async function generateReal() {
    if (!engineSupports(s.action)) {
      toast({ title: 'Not available yet', description: 'Your digital twin can Talk and Greet today — gesture, walk and demonstrate need a body-motion model.', tone: 'info' })
      return
    }
    if (!engineSupportsLanguage(s.language)) {
      toast({ title: `${s.language} voice isn't supported yet`, description: 'The voice model supports English, Hindi, Spanish, French, German, Arabic and more.', tone: 'info' })
      return
    }
    try {
      const j = await engine.generate(s.avatarId, { script: s.prompt.trim(), action: s.action, language: s.language })
      const v = {
        id: j.job_id,
        title: s.prompt.trim().split(/[.!?]/)[0].slice(0, 48) || 'Untitled video',
        avatarId: s.avatarId,
        voiceId: s.voiceId,
        prompt: s.prompt.trim(),
        action: s.action,
        scene: s.scene,
        aspect: s.aspect,
        language: s.language,
        durationSec: 0,
        status: 'generating' as const,
        progress: 0,
        createdAt: new Date().toISOString(),
      }
      addVideo(v)
      setVideoId(v.id)
      setEngineRun(true)
      setPhase('generating')
      job.setState('running')
      job.setProgress(2)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      enginePoll.current = window.setInterval(async () => {
        try {
          const snap = await engine.job(v.id)
          const p = engine.videoPatch(snap)
          update.current(v.id, p)
          if (snap.status === 'done') {
            window.clearInterval(enginePoll.current)
            job.setProgress(100)
            job.setState('done')
            setPhase('ready')
            toast(
              snap.consistency?.verdict === 'verified'
                ? { title: 'Your video is ready', description: `${avatar?.name ?? 'Your avatar'} passed the identity consistency check.` }
                : { title: 'Your video is ready — review needed', description: snap.consistency?.reason ?? 'Some frames drifted from the reference identity.', tone: 'info' },
            )
          } else if (snap.status === 'failed' || snap.status === 'rejected') {
            window.clearInterval(enginePoll.current)
            job.reset()
            setPhase('idle')
            setEngineRun(false)
            toast({ title: snap.status === 'rejected' ? 'Rejected by the identity check' : 'Generation failed', description: snap.error ?? 'Please try again.', tone: 'error' })
          } else {
            job.setProgress(Math.max(2, p.progress ?? 0))
          }
        } catch {
          /* transient — keep polling */
        }
      }, 2000)
    } catch (e) {
      toast({ title: 'Could not start generation', description: e instanceof Error ? e.message : 'Please try again.', tone: 'error' })
    }
  }

  const generate = useCallback(async () => {
    if (!promptOk || !online || submitting) return
    setSubmitting(true)
    if (engineEnabled && avatar?.engine) {
      try {
        await generateReal()
      } finally {
        setSubmitting(false)
      }
      return
    }
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
    // generateReal is recreated each render and reads the same state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptOk, online, submitting, s, addVideo, job, toast, avatar?.engine])

  const cancel = () => {
    window.clearInterval(enginePoll.current)
    setEngineRun(false)
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
        {isDemo && !(engineEnabled && avatar?.engine) && <DemoNote className="mt-2 sm:mt-0">Rendering is simulated in demo mode.</DemoNote>}
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
