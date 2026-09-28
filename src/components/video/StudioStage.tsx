import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { AspectRatio, Scene, Video } from '@/types'
import { AvatarPreview, AvatarChip, type AvatarLike } from '@/components/avatar/AvatarPreview'
import { sceneBg } from './VideoThumb'
import { VideoPlayer } from './VideoPlayer'
import { useFitFrame } from './useFitFrame'
import { ASPECT_VALUE, sceneLabel } from './studio'

export type StudioPhase = 'idle' | 'generating' | 'ready'

/**
 * The cinematic preview stage. The frame morphs between aspect ratios and
 * cross-fades between idle preview → generation → finished player.
 */
export function StudioStage({
  phase,
  avatar,
  scene,
  aspect,
  backgroundUrl,
  progress,
  stageLabel,
  video,
  footer,
  className,
}: {
  phase: StudioPhase
  avatar: (AvatarLike & { name?: string }) | undefined
  scene: Scene
  aspect: AspectRatio
  backgroundUrl?: string | null
  progress: number
  stageLabel: string
  video?: Video
  footer?: ReactNode
  className?: string
}) {
  const shownAspect = phase === 'ready' && video ? video.aspect : aspect
  const fit = useFitFrame<HTMLDivElement>(ASPECT_VALUE[shownAspect], 4)
  const hue = avatar?.hue ?? 255
  const name = avatar?.name ?? 'Your avatar'
  const bg = scene === 'custom' && backgroundUrl ? `linear-gradient(180deg, rgb(0 0 0 / 0.15), rgb(0 0 0 / 0.55)), url("${backgroundUrl}") center / cover` : sceneBg[scene](hue)
  const framing = shownAspect === '16:9' ? 'stage' : 'portrait'

  return (
    <section
      aria-label="Video preview"
      className={cn('relative isolate flex min-w-0 flex-col overflow-hidden rounded-panel border border-line bg-[#060609] lg:rounded-hero', className)}
    >
      {/* ambient stage light */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 grid-lines opacity-60 [mask-image:radial-gradient(70%_60%_at_50%_45%,black,transparent)]" />
        <div
          className="absolute inset-0 transition-[background] duration-700"
          style={{ background: `radial-gradient(50% 45% at 50% 42%, hsl(${hue} 70% 50% / ${phase === 'generating' ? 0.22 : 0.14}), transparent 75%)` }}
        />
      </div>

      {/* top bar */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 text-[12px] text-fg-subtle">
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              phase === 'generating' ? 'animate-pulse-soft bg-accent' : phase === 'ready' ? 'bg-success' : 'bg-fg-subtle',
            )}
            aria-hidden
          />
          <span className="truncate font-medium uppercase tracking-[0.14em]">
            {phase === 'generating' ? 'Rendering' : phase === 'ready' ? 'Final cut' : 'Live preview'}
          </span>
        </div>
        <span className="inline-flex h-7 shrink-0 items-center gap-2 rounded-full border border-line bg-white/[0.03] pl-1 pr-2.5 text-[12px] text-fg-muted">
          <AvatarChip avatar={avatar} size={20} />
          Powered by <span className="text-fg">{name}</span>
        </span>
      </div>

      {/* stage */}
      <div ref={fit.ref} className="relative h-[280px] min-h-0 px-3 py-3 sm:h-[380px] sm:px-6 sm:py-5 lg:h-auto lg:flex-1">
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[width,height] duration-500 ease-out-soft"
          style={{ width: fit.w, height: fit.h }}
        >
          {phase === 'ready' && video ? (
            <div key={`ready-${video.id}`} className="size-full animate-fade-in">
              <VideoPlayer video={video} avatar={avatar} className="size-full" />
            </div>
          ) : (
            <div
              key="frame"
              className={cn(
                'relative size-full overflow-hidden rounded-[18px] border shadow-[0_40px_100px_-30px_rgb(0_0_0/0.95)] transition-[border-color,box-shadow] duration-500',
                phase === 'generating' ? 'border-accent/35 shadow-[0_0_0_1px_rgb(143_124_255/0.15),0_40px_100px_-30px_rgb(0_0_0/0.95)]' : 'border-white/10',
              )}
              style={{ background: bg }}
            >
              <div className="absolute inset-0">
                <AvatarPreview
                  avatar={avatar}
                  alive
                  scanning={phase === 'generating'}
                  framing={framing}
                  rounded="rounded-none"
                  className="size-full !bg-transparent ![background-image:none]"
                />
              </div>

              {phase === 'idle' ? (
                <div key="idle" className="absolute inset-x-0 bottom-0 animate-fade-in bg-gradient-to-t from-black/70 to-transparent px-4 pb-3.5 pt-10">
                  <p className="text-[12px] font-medium text-white/85">
                    Preview · {name} in {sceneLabel(scene)}
                  </p>
                </div>
              ) : (
                <div key="gen" className="absolute inset-0 flex animate-fade-in flex-col items-center justify-center bg-black/35 px-4 text-center">
                  <Sparkles className="size-5 animate-pulse-soft text-accent" aria-hidden />
                  <p className="tabular mt-3 text-[40px] font-semibold leading-none tracking-[-0.03em] text-white sm:text-[56px]">
                    {progress}
                    <span className="text-[0.5em] text-white/60">%</span>
                  </p>
                  <p className="mt-3 text-[13px] text-white/80">Your avatar is creating the video...</p>
                  <p className="mt-1 text-[12px] text-white/50" aria-hidden>
                    {stageLabel}
                  </p>
                </div>
              )}

              <span className="absolute left-3 top-3 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/80 backdrop-blur">
                {shownAspect}
              </span>
            </div>
          )}
        </div>
      </div>

      {footer && <div className="relative border-t border-line bg-black/20 backdrop-blur-sm">{footer}</div>}
    </section>
  )
}
