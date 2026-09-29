import { useId, useState } from 'react'
import { AlertCircle, Camera, Clock, Images, ScanFace, Sparkles, Sun, Upload, Video } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Field, Input, SegmentedControl } from '@/components/ui/Form'
import { CameraRecorder } from './CameraRecorder'
import { PhotoPicker } from './PhotoPicker'
import { UploadZone } from '@/components/ui/UploadZone'
import { ReferencePreview, type ReferenceSource } from './ReferencePreview'
import { StepHeading } from './StepHeading'

const MAX_BYTES = 2 * 1024 ** 3
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi)$/i

const requirements = [
  { icon: ScanFace, title: 'Clear face', text: 'Face the camera, unobstructed — no sunglasses or hands over your face.' },
  { icon: Sun, title: 'Good lighting', text: 'Soft, even light from the front. Avoid strong backlight.' },
    { icon: Video, title: 'Stable camera', text: 'Tripod or steady surface, chest-up framing.' },
  { icon: Clock, title: 'About 1 minute', text: 'Talk naturally for 30 seconds, then sit still with lips closed for 30 seconds. 1080p camera.' },
]

/** Returns an error message, or null when the file is an acceptable reference video. */
export function validateReference(file: File): string | null {
  const isVideo = file.type ? file.type.startsWith('video/') : VIDEO_EXT.test(file.name)
  if (!isVideo) return `“${file.name}” isn’t a video. Upload an MP4, MOV or WebM file.`
  if (file.size > MAX_BYTES) return `“${file.name}” is larger than 2 GB. Trim it or export at a lower bitrate.`
  return null
}

export function UploadStep({
  source,
  onSource,
  name,
  onName,
  error,
  onError,
  focusOnMount,
}: {
  source: ReferenceSource | null
  onSource: (s: ReferenceSource | null) => void
  name: string
  onName: (v: string) => void
  error: string | null
  onError: (e: string | null) => void
  focusOnMount?: boolean
}) {
  const nameId = useId()
  const [mode, setMode] = useState<'upload' | 'camera' | 'photos'>(source?.kind === 'photos' ? 'photos' : 'upload')

  const accept = (files: File[]) => {
    const file = files[0]
    if (!file) return
    const err = validateReference(file)
    onError(err)
    if (!err) onSource({ kind: 'file', file })
  }

  return (
    <section>
      <StepHeading
        eyebrow="Step 1 · Reference video"
        title="Create your digital twin"
        description="Upload or record a short video of yourself. We'll use it to create a reusable AI avatar."
        focusOnMount={focusOnMount}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
        <div className="min-w-0">
          {source && source.kind !== 'photos' ? (
            <ReferencePreview
              key={source.kind === 'file' ? `${source.file.name}-${source.file.size}-${source.file.lastModified}` : 'sample'}
              source={source}
              onReplace={accept}
              onRemove={() => {
                onSource(null)
                onError(null)
              }}
            />
          ) : (
            <>
              <SegmentedControl
                label="How to create your avatar"
                value={mode}
                onChange={setMode}
                className="mb-4"
                options={[
                  { value: 'upload', label: 'Upload video', icon: <Upload aria-hidden /> },
                  { value: 'camera', label: 'Record', icon: <Camera aria-hidden /> },
                  { value: 'photos', label: 'Photos', icon: <Images aria-hidden /> },
                ]}
              />
              {mode === 'photos' ? (
                <PhotoPicker
                  photos={source?.kind === 'photos' ? source.photos : []}
                  voice={source?.kind === 'photos' ? source.voice : null}
                  error={error}
                  onError={onError}
                  onChange={(photos, voice) => onSource(photos.length ? { kind: 'photos', photos, voice } : null)}
                />
              ) : mode === 'camera' ? (
                <CameraRecorder onRecorded={(file) => accept([file])} onCancel={() => setMode('upload')} />
              ) : (
              <UploadZone
                size="lg"
                accept="video/*"
                onFiles={accept}
                icon={<Video aria-hidden />}
                title="Drop your reference video"
                description="MP4, MOV or WebM · up to 2 GB · about 1 minute (30 s talking + 30 s still)"
                className={cn('animate-fade-up', error && 'border-danger/50 bg-danger/[0.035] hover:border-danger/60')}
              >
                {error && (
                  <p role="alert" className="relative mt-5 inline-flex max-w-md items-start gap-2 rounded-[10px] border border-danger/25 bg-danger/10 px-3 py-2 text-left text-[13px] text-[#ff8a95]">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {error}
                  </p>
                )}
              </UploadZone>
              )}
              <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-card border border-line bg-white/[0.02] px-4 py-3 sm:flex-row">
                <p className="text-center text-[13px] text-fg-muted sm:text-left">
                  <span className="font-medium text-fg">Just exploring?</span> Continue with sample footage — nothing is uploaded.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Sparkles aria-hidden />}
                  onClick={() => {
                    onError(null)
                    onSource({ kind: 'sample' })
                  }}
                >
                  Use sample footage
                </Button>
              </div>
            </>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          {source && (
            <div className="rounded-panel border border-line bg-surface p-5 animate-fade-up">
              <Field
                label="Avatar name"
                htmlFor={nameId}
                hint="You can rename it later. It appears wherever this identity is used."
                error={name.trim() ? undefined : 'Give your avatar a name to continue.'}
              >
                <Input id={nameId} value={name} maxLength={48} onChange={(e) => onName(e.target.value)} aria-invalid={!name.trim()} autoComplete="off" />
              </Field>
            </div>
          )}

          <div className="rounded-panel border border-line bg-white/[0.02] p-5 animate-fade-up" style={{ animationDelay: '80ms' }}>
            <h2 className="text-[15px] font-semibold">For the best likeness</h2>
            <p className="mt-1 text-[13px] text-fg-muted">A few minutes of good footage goes a long way.</p>
            <ul className="mt-4 flex flex-col gap-3.5">
              {requirements.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-line-strong bg-white/[0.04]">
                    <Icon className="size-4 text-fg-muted" aria-hidden />
                  </span>
                  <div className="min-w-0">
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
