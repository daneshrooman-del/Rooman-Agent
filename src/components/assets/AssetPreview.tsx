import { Pause, Play } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDuration } from '@/lib/format'
import type { Avatar } from '@/types'
import { AvatarPreview } from '@/components/avatar/AvatarPreview'
import { VideoThumb } from '@/components/video/VideoThumb'
import { fileExt, hashString, sceneFor, type LibraryAsset } from './assetMeta'
import { usePlayback, Waveform } from './Waveform'

type Variant = 'card' | 'large' | 'thumb'

/** Kind-specific visual for an asset: video scene, waveform, avatar portrait, document page or image swatch. */
export function AssetPreview({ asset, avatar, variant = 'card', className }: { asset: LibraryAsset; avatar: Avatar | undefined; variant?: Variant; className?: string }) {
  const hue = asset.hue ?? avatar?.hue ?? 250
  const frame = cn('relative isolate aspect-video w-full overflow-hidden', className)

  switch (asset.kind) {
    case 'video':
      return (
        <VideoThumb
          className={frame}
          avatar={avatar ?? { hue }}
          showMeta={variant !== 'thumb'}
          video={{ scene: sceneFor(asset), aspect: '16:9', durationSec: asset.durationSec ?? 0, status: 'ready' }}
        />
      )
    case 'audio':
      return <AudioPreview asset={asset} hue={hue} variant={variant} className={frame} />
    case 'avatar':
      return <AvatarPreview avatar={avatar ?? { hue, name: asset.name }} alive={variant === 'large'} framing="stage" rounded="rounded-none" className={frame} />
    case 'document':
      return <DocumentPreview name={asset.name} variant={variant} className={frame} />
    case 'image':
      return <ImagePreview name={asset.name} hue={hue} variant={variant} className={frame} />
  }
}

function AudioPreview({ asset, hue, variant, className }: { asset: LibraryAsset; hue: number; variant: Variant; className?: string }) {
  const duration = asset.durationSec ?? 0
  const { playing, elapsed, toggle } = usePlayback(duration)
  const thumb = variant === 'thumb'
  return (
    <div
      className={cn(className, 'flex items-center', thumb ? 'px-2' : 'gap-4 px-5')}
      style={{ background: `radial-gradient(90% 120% at 0% 0%, hsl(${hue} 60% 40% / 0.28), transparent 60%), linear-gradient(180deg, #101017, #08080c)` }}
    >
      {!thumb && (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={playing}
          aria-label={playing ? `Pause ${asset.name}` : `Play ${asset.name}`}
          className={cn(
            'relative z-10 flex shrink-0 items-center justify-center rounded-full bg-white text-canvas shadow-[0_8px_24px_-8px_rgb(0_0_0/0.8)] transition-transform hover:scale-105 active:scale-95',
            variant === 'large' ? 'size-14 [&_svg]:size-5' : 'size-10 [&_svg]:size-4',
          )}
        >
          {playing ? <Pause className="fill-current" aria-hidden /> : <Play className="translate-x-px fill-current" aria-hidden />}
        </button>
      )}
      <div className={cn('flex-1', thumb ? 'h-1/2' : variant === 'large' ? 'h-24' : 'h-12')}>
        <Waveform seed={asset.id} bars={thumb ? 20 : variant === 'large' ? 80 : 44} playing={playing} progress={duration ? elapsed / duration : 0} />
      </div>
      {!thumb && (
        <span className="tabular absolute bottom-2.5 right-2.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur" aria-live={playing ? 'off' : undefined}>
          {playing ? `${formatDuration(elapsed)} / ` : ''}
          {formatDuration(duration)}
        </span>
      )}
    </div>
  )
}

function DocumentPreview({ name, variant, className }: { name: string; variant: Variant; className?: string }) {
  const ext = fileExt(name) || 'DOC'
  const lines = variant === 'large' ? 11 : 6
  const seed = hashString(name)
  const tint = ext === 'PDF' ? 'text-[#ff9aa4]' : ext === 'CSV' || ext === 'XLSX' ? 'text-success' : 'text-[#a3c0ff]'
  const tabular = ext === 'CSV' || ext === 'XLSX'
  return (
    <div className={cn(className, 'flex items-end justify-center bg-[linear-gradient(180deg,#111118,#08080c)]')}>
      <div aria-hidden className="pointer-events-none absolute inset-0 grid-lines opacity-30 [mask-image:radial-gradient(70%_70%_at_50%_60%,black,transparent)]" />
      <div
        className={cn(
          'relative translate-y-[12%] rounded-t-[8px] border border-white/[0.1] bg-[linear-gradient(180deg,rgb(255_255_255/0.08),rgb(255_255_255/0.03))] shadow-[0_-20px_40px_-20px_rgb(0_0_0/0.9)]',
          variant === 'thumb' ? 'h-[80%] w-[46%] p-1.5' : 'h-[82%] w-[44%] p-[7%]',
        )}
      >
        <span className="absolute right-0 top-0 size-[18%] max-h-6 max-w-6 rounded-bl-[6px] border-b border-l border-white/[0.12] bg-white/[0.06]" />
        {variant !== 'thumb' && (
          <span className={cn('mb-[8%] inline-flex rounded-[5px] border border-current/20 bg-white/[0.04] px-1.5 py-px text-[10px] font-semibold tracking-wider', tint)}>{ext}</span>
        )}
        <div className="flex flex-col gap-[6px]">
          {Array.from({ length: lines }).map((_, i) =>
            tabular ? (
              <div key={i} className="flex gap-1">
                {[0, 1, 2].map((c) => (
                  <span key={c} className={cn('h-[3px] flex-1 rounded-full', i === 0 ? 'bg-white/30' : 'bg-white/[0.12]')} />
                ))}
              </div>
            ) : (
              <span key={i} className={cn('h-[3px] rounded-full', i === 0 ? 'bg-white/30' : 'bg-white/[0.12]')} style={{ width: i === 0 ? '55%' : `${62 + ((seed >> i) % 36)}%` }} />
            ),
          )}
        </div>
      </div>
    </div>
  )
}

function ImagePreview({ name, hue, variant, className }: { name: string; hue: number; variant: Variant; className?: string }) {
  const ext = fileExt(name)
  const h2 = (hue + 50) % 360
  return (
    <div
      className={className}
      style={{
        background: `radial-gradient(60% 80% at 25% 20%, hsl(${hue} 70% 58% / 0.55), transparent 70%), radial-gradient(70% 70% at 85% 85%, hsl(${h2} 75% 50% / 0.45), transparent 70%), linear-gradient(160deg, hsl(${hue} 30% 14%), #07070a)`,
      }}
    >
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
      <div aria-hidden className="absolute inset-x-[8%] bottom-[30%] h-px bg-white/10" />
      {variant !== 'thumb' && ext && (
        <span className="absolute left-2.5 top-2.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/80 backdrop-blur">{ext}</span>
      )}
    </div>
  )
}
