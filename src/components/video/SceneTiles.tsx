import { useId } from 'react'
import { Check, ImagePlus, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatBytes } from '@/lib/format'
import type { Scene } from '@/types'
import { AvatarPreview, type AvatarLike } from '@/components/avatar/AvatarPreview'
import { sceneBg } from './VideoThumb'
import { SCENES } from './studio'

/** Scene picker: visual tiles with a miniature of the avatar in each set. */
export function SceneTiles({
  value,
  onChange,
  avatar,
  background,
  onBackground,
  disabled,
}: {
  value: Scene
  onChange: (s: Scene) => void
  avatar: AvatarLike | undefined
  background: File | null
  onBackground: (f: File | null) => void
  disabled?: boolean
}) {
  const inputId = useId()
  const hue = avatar?.hue ?? 255
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Scene" className="grid grid-cols-3 gap-2.5">
        {SCENES.map((s) => {
          const active = s.value === value
          return (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(s.value)}
              className={cn(
                'group flex flex-col overflow-hidden rounded-[12px] border text-left transition-all duration-200 disabled:opacity-50',
                active ? 'border-accent/60 shadow-[0_0_0_3px_rgb(143_124_255/0.12)]' : 'border-line-strong hover:border-white/20',
              )}
            >
              <span className="relative block aspect-[4/3] overflow-hidden" style={{ background: sceneBg[s.value](hue) }} aria-hidden>
                <span className="absolute inset-x-[18%] bottom-0 top-[14%] block transition-transform duration-500 ease-out-soft group-hover:scale-[1.04]">
                  <AvatarPreview avatar={avatar} alive={false} rounded="rounded-none" framing="close" className="size-full !bg-transparent ![background-image:none]" />
                </span>
                {s.value === 'custom' && !background && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <ImagePlus className="size-4 text-white/80" />
                  </span>
                )}
                {active && (
                  <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-accent text-white">
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className={cn('px-2.5 py-2 text-[12px] font-medium', active ? 'text-fg' : 'text-fg-muted')}>{s.label}</span>
            </button>
          )
        })}
      </div>

      {value === 'custom' && (
        <div className="flex animate-fade-up items-center gap-3 rounded-[12px] border border-dashed border-line-strong bg-white/[0.02] p-2.5 pl-3">
          <ImagePlus className="size-4 shrink-0 text-fg-subtle" aria-hidden />
          <div className="min-w-0 flex-1">
            {background ? (
              <>
                <p className="truncate text-[13px] font-medium">{background.name}</p>
                <p className="text-[11px] text-fg-subtle">{formatBytes(background.size)} · background image</p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-medium">Background image</p>
                <p className="text-[11px] text-fg-subtle">JPG or PNG, 1920px or larger works best</p>
              </>
            )}
          </div>
          {background ? (
            <button
              type="button"
              onClick={() => onBackground(null)}
              aria-label="Remove background image"
              className="flex size-8 shrink-0 items-center justify-center rounded-[9px] text-fg-muted hover:bg-white/[0.06] hover:text-fg"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : (
            <label
              htmlFor={inputId}
              className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-[9px] border border-line-strong bg-white/[0.06] px-3 text-[13px] font-medium transition-colors focus-within:outline-2 focus-within:outline-accent hover:bg-white/[0.1]"
            >
              Upload
              <input
                id={inputId}
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={disabled}
                onChange={(e) => {
                  onBackground(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
              />
            </label>
          )}
        </div>
      )}
    </div>
  )
}
