import { useId, useRef, useState } from 'react'
import { BookOpen, Link2, Plus } from 'lucide-react'
import type { Agent, KnowledgeSource } from '@/types'
import { useWorkspace } from '@/state/workspace'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'
import { SectionHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/States'
import { UploadZone } from '@/components/ui/UploadZone'
import { useToast } from '@/components/ui/Toast'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { KnowledgeItem, knowledgeGrid } from './KnowledgeItem'
import { TypeChips, acceptAttr, typeFromName } from './fileTypes'
import { markRetried } from './useIndexingJobs'

const newId = () => `k_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

export function KnowledgePanel({ agent }: { agent: Agent }) {
  const { updateAgent } = useWorkspace()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const urlId = useId()
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)

  const commit = (knowledge: KnowledgeSource[]) => {
    updateAgent(agent.id, { knowledge })
    void api.saveAgent({ ...agent, knowledge })
  }

  const addFiles = (files: File[]) => {
    const accepted = files.filter((f) => typeFromName(f.name))
    const rejected = files.length - accepted.length
    if (rejected) toast({ title: `${rejected} file${rejected > 1 ? 's' : ''} skipped`, description: 'Supported: PDF, DOCX, PPTX, TXT, CSV, XLSX.', tone: 'error' })
    if (!accepted.length) return
    const now = new Date().toISOString()
    const items: KnowledgeSource[] = accepted.map((f) => ({ id: newId() + f.name.length, name: f.name, type: typeFromName(f.name)!, sizeBytes: f.size, status: 'queued', chunks: 0, updatedAt: now }))
    commit([...items, ...agent.knowledge])
    toast({ title: `Uploading ${accepted.length} ${accepted.length === 1 ? 'file' : 'files'}`, description: 'Queued for indexing.', tone: 'info' })
  }

  const addUrl = () => {
    const raw = url.trim()
    let parsed: URL
    try {
      parsed = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`)
      if (!parsed.hostname.includes('.')) throw new Error('bad')
    } catch {
      setUrlError('Enter a valid web address, e.g. company.com/careers')
      return
    }
    const name = (parsed.hostname.replace(/^www\./, '') + parsed.pathname).replace(/\/$/, '')
    commit([{ id: newId(), name, type: 'url', sizeBytes: 0, status: 'queued', chunks: 0, updatedAt: new Date().toISOString() }, ...agent.knowledge])
    setUrl('')
    setUrlError(null)
  }

  const remove = (k: KnowledgeSource) => {
    commit(agent.knowledge.filter((x) => x.id !== k.id))
    toast({ title: 'Source removed', description: `${k.name} is no longer used by ${agent.name}.` })
  }

  const retry = (k: KnowledgeSource) => {
    markRetried(k.id)
    commit(agent.knowledge.map((x) => (x.id === k.id ? { ...x, status: 'queued', progress: undefined } : x)))
  }

  const ready = agent.knowledge.filter((k) => k.status === 'ready')
  const chunks = ready.reduce((s, k) => s + k.chunks, 0)

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        className="mb-0"
        title="Agent Knowledge"
        description={
          agent.knowledge.length
            ? `${agent.knowledge.length} sources · ${ready.length} ready · ${formatNumber(chunks)} chunks the agent can cite`
            : 'Documents and pages the agent uses to answer accurately.'
        }
        action={
          <>
            <Button variant="primary" size="sm" leftIcon={<Plus />} onClick={() => fileInput.current?.click()}>
              Add knowledge
            </Button>
            <input ref={fileInput} type="file" multiple accept={acceptAttr} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []))
              e.target.value = ''
            }} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <UploadZone accept={acceptAttr} multiple onFiles={addFiles} title="Drop documents to teach this agent" description="Files are chunked, embedded and cited in answers. Up to 50 MB each.">
          <TypeChips className="relative mt-5" />
        </UploadZone>
        <form
          className="surface flex flex-col justify-center gap-3 rounded-panel p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault()
            addUrl()
          }}
          noValidate
        >
          <span className="flex size-10 items-center justify-center rounded-[12px] border border-line-strong bg-white/[0.04] text-fg-muted">
            <Link2 className="size-[18px]" aria-hidden />
          </span>
          <label htmlFor={urlId} className="text-[15px] font-semibold">
            Add a web page
          </label>
          <p className="-mt-1 text-[13px] text-fg-muted">Careers pages, help centers and policies — re-crawled weekly.</p>
          <Input
            id={urlId}
            inputMode="url"
            placeholder="company.com/careers"
            value={url}
            aria-invalid={!!urlError}
            aria-describedby={urlError ? `${urlId}-err` : undefined}
            onChange={(e) => {
              setUrl(e.target.value)
              setUrlError(null)
            }}
          />
          {urlError && (
            <p id={`${urlId}-err`} role="alert" className="text-[12px] text-danger">
              {urlError}
            </p>
          )}
          <Button type="submit" variant="secondary" disabled={!url.trim()}>
            Add URL
          </Button>
        </form>
      </div>

      {agent.knowledge.length === 0 ? (
        <EmptyState compact icon={<BookOpen />} title="No knowledge yet" description="Upload a handbook, a spreadsheet of open roles or a policy doc. The agent answers only from what you give it." />
      ) : (
        <div className="sm:surface sm:overflow-hidden sm:rounded-panel">
          <div className={`hidden border-b border-line px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-fg-subtle ${knowledgeGrid}`} aria-hidden>
            <span>File</span>
            <span>Size</span>
            <span>Status</span>
            <span>Chunks</span>
            <span>Updated</span>
            <span />
          </div>
          <ul className="flex flex-col gap-3 sm:gap-0 sm:divide-y sm:divide-line" aria-label="Knowledge sources">
            {agent.knowledge.map((k) => (
              <KnowledgeItem key={k.id} item={k} onRemove={() => remove(k)} onRetry={() => retry(k)} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
