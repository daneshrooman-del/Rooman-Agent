import { useEffect, useId, useState } from 'react'
import { AlertCircle, ImagePlus, Mic, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatBytes } from '@/lib/format'
import { buttonStyles } from '@/components/ui/Button'
import { UploadZone } from '@/components/ui/UploadZone'

export const MAX_PHOTOS = 5
/** Voice cloning is off for now — avatars are face-only and videos use the default voice. */
const VOICE_CLIPS_ENABLED = false
const IMAGE = /\.(jpe?g|png|webp|bmp)$/i
const MAX_PHOTO_BYTES = 25 * 1024 ** 2

export function validatePhoto(f: File): string | null {
  const isImage = f.type ? f.type.startsWith('image/') : IMAGE.test(f.name)
  if (!isImage) return `“${f.name}” isn’t a photo. Use JPG, PNG or WebP.`
  if (f.size > MAX_PHOTO_BYTES) return `“${f.name}” is over 25 MB.`
  return null
}

function Thumb({ file, onRemove, index }: { file: File; onRemove: () => void; index: number }) {
  // create + revoke in the same effect: a memoised URL gets revoked by StrictMode's double effect run
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  return (
    <li className="group relative aspect-[3/4] overflow-hidden rounded-[14px] border border-line bg-black">
      {url && <img src={url} alt={`Photo ${index + 1}`} className="size-full object-cover" />}
      {index === 0 && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] backdrop-blur">Main</span>}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove photo ${index + 1}`}
        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-opacity hover:bg-black/80 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </li>
  )
}

/** Pick 1–5 photos of one person (3 recommended) + an optional voice clip. */
export function PhotoPicker({
  photos,
  voice,
  onChange,
  error,
  onError,
}: {
  photos: File[]
  voice: File | null
  onChange: (photos: File[], voice: File | null) => void
  error: string | null
  onError: (e: string | null) => void
}) {
  const voiceId = useId()
  const add = (files: File[]) => {
    const bad = files.map(validatePhoto).find(Boolean)
    if (bad) return onError(bad)
    const next = [...photos, ...files].slice(0, MAX_PHOTOS)
    onError(files.length + photos.length > MAX_PHOTOS ? `Up to ${MAX_PHOTOS} photos — extra ones were skipped.` : null)
    onChange(next, voice)
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5" aria-label="Selected photos">
          {photos.map((f, i) => (
            <Thumb key={`${f.name}-${f.size}-${f.lastModified}`} file={f} index={i} onRemove={() => onChange(photos.filter((_, j) => j !== i), voice)} />
          ))}
        </ul>
      )}

      {photos.length < MAX_PHOTOS && (
        <UploadZone
          size={photos.length ? 'md' : 'lg'}
          accept="image/*"
          multiple
          onFiles={add}
          icon={<ImagePlus aria-hidden />}
          title={photos.length ? 'Add more photos' : 'Drop 3 photos of yourself'}
          description="Same person in every photo · front, slightly left, slightly right · good light, one face per photo"
          className={cn(error && 'border-danger/50 bg-danger/[0.035]')}
        >
          {error && (
            <p role="alert" className="relative mt-4 inline-flex max-w-md items-start gap-2 rounded-[10px] border border-danger/25 bg-danger/10 px-3 py-2 text-left text-[13px] text-[#ff8a95]">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}
        </UploadZone>
      )}

      {/* optional voice (hidden while voice cloning is off) */}
      {VOICE_CLIPS_ENABLED && (
      <div className="flex flex-col gap-3 rounded-card border border-line bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-line-strong bg-white/[0.04]">
            <Mic className="size-4 text-fg-muted" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium">Your voice <span className="font-normal text-fg-subtle">(optional)</span></p>
            <p className="truncate text-[12px] text-fg-subtle">
              {voice ? `${voice.name} · ${formatBytes(voice.size)}` : 'Add a 10–30 s audio or video of you talking. Without it, a stock voice is used.'}
            </p>
          </div>
        </div>
        {voice ? (
          <button type="button" onClick={() => onChange(photos, null)} className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
            <Trash2 aria-hidden /> Remove
          </button>
        ) : (
          <label htmlFor={voiceId} className={cn(buttonStyles({ variant: 'secondary', size: 'sm' }), 'cursor-pointer focus-within:outline-2 focus-within:outline-accent')}>
            Add voice clip
            <input
              id={voiceId}
              type="file"
              accept="audio/*,video/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onChange(photos, f)
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
