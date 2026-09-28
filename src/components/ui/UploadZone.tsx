import { useId, useRef, useState, type ReactNode } from 'react'
import { UploadCloud } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Drag-and-drop + click-to-browse file picker. Keyboard accessible. */
export function UploadZone({
  accept,
  multiple,
  onFiles,
  title = 'Drop files here',
  description,
  icon,
  size = 'md',
  className,
  children,
}: {
  accept?: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  title?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  size?: 'md' | 'lg'
  className?: string
  children?: ReactNode
}) {
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const files = Array.from(e.dataTransfer.files)
        if (files.length) onFiles(multiple ? files : files.slice(0, 1))
      }}
      className={cn(
        'group relative flex flex-col items-center justify-center overflow-hidden rounded-panel border border-dashed text-center transition-all duration-300',
        size === 'lg' ? 'min-h-[340px] px-6 py-12' : 'min-h-[180px] px-6 py-8',
        over ? 'border-accent/70 bg-accent/[0.07] shadow-glow' : 'border-line-strong bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.035]',
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 grid-lines opacity-40 [mask-image:radial-gradient(60%_60%_at_50%_50%,black,transparent)]" />
      <div
        className={cn(
          'relative mb-4 flex items-center justify-center rounded-[18px] border border-line-strong bg-white/[0.05] text-fg transition-transform duration-300 group-hover:-translate-y-0.5',
          size === 'lg' ? 'size-16 [&_svg]:size-7' : 'size-12 [&_svg]:size-5',
        )}
      >
        {icon ?? <UploadCloud />}
      </div>
      <p className={cn('relative font-semibold', size === 'lg' ? 'text-lg' : 'text-[15px]')}>{title}</p>
      {description && <p className="relative mt-1.5 max-w-md text-[13px] text-fg-muted">{description}</p>}
      <label htmlFor={id} className="relative mt-5 inline-flex h-10 cursor-pointer items-center rounded-control border border-line-strong bg-white/[0.06] px-4 text-sm font-medium transition-colors hover:bg-white/[0.1] focus-within:outline-2 focus-within:outline-accent">
        Browse files
        <input
          ref={input}
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length) onFiles(files)
            e.target.value = ''
          }}
        />
      </label>
      {children}
    </div>
  )
}
