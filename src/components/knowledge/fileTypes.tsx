import { File, FileSpreadsheet, FileText, Globe, Presentation, Table2, type LucideIcon } from 'lucide-react'
import type { KnowledgeSource } from '@/types'
import { cn } from '@/lib/cn'

export type KnowledgeType = KnowledgeSource['type']

export const fileTypeMeta: Record<KnowledgeType, { label: string; icon: LucideIcon; rgb: string }> = {
  pdf: { label: 'PDF', icon: FileText, rgb: '255 122 142' },
  docx: { label: 'DOCX', icon: FileText, rgb: '91 141 255' },
  pptx: { label: 'PPTX', icon: Presentation, rgb: '242 160 75' },
  txt: { label: 'TXT', icon: File, rgb: '163 163 178' },
  csv: { label: 'CSV', icon: Table2, rgb: '62 213 152' },
  xlsx: { label: 'XLSX', icon: FileSpreadsheet, rgb: '62 213 152' },
  url: { label: 'URL', icon: Globe, rgb: '143 124 255' },
}

export const uploadTypes: KnowledgeType[] = ['pdf', 'docx', 'pptx', 'txt', 'csv', 'xlsx']
export const acceptAttr = uploadTypes.map((t) => `.${t}`).join(',')

export function typeFromName(name: string): KnowledgeType | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return (uploadTypes as string[]).includes(ext) ? (ext as KnowledgeType) : null
}

export function FileTypeIcon({ type, size = 'md' }: { type: KnowledgeType; size?: 'sm' | 'md' }) {
  const m = fileTypeMeta[type]
  return (
    <span
      aria-hidden
      className={cn('relative flex shrink-0 items-center justify-center border', size === 'sm' ? 'size-7 rounded-[8px]' : 'size-10 rounded-[11px]')}
      style={{ background: `rgb(${m.rgb} / 0.1)`, borderColor: `rgb(${m.rgb} / 0.22)`, color: `rgb(${m.rgb})` }}
    >
      <m.icon className={size === 'sm' ? 'size-3.5' : 'size-[18px]'} />
    </span>
  )
}

export function TypeChips({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-wrap justify-center gap-1.5', className)} aria-label="Accepted file types">
      {uploadTypes.map((t) => (
        <li key={t} className="tabular inline-flex h-6 items-center rounded-full border border-line bg-white/[0.03] px-2.5 text-[11px] font-medium tracking-wide text-fg-muted">
          {fileTypeMeta[t].label}
        </li>
      ))}
    </ul>
  )
}
