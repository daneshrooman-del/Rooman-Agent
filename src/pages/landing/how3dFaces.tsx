import type { ReactNode } from 'react'
import { AudioLines, Check, FileText, Mic, ScanFace, Sparkles, Video } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Corners, Label, Photo, Wave } from './how3dParts'

/* Faces for the How it works prisms (one per step). */

/* ───────── face building blocks ───────── */

const SHALYA = '/avatars/clips/shalya_rest.jpg'
const ARIA = '/avatars/clips/aria_rest.jpg'

/* Stage 1 faces: Record, Ingest, Train, Generate, Check */
export const AVATAR_FACES: ReactNode[] = [
  <Photo key="rec" src={SHALYA}>
    <Label dark><span className="size-2 animate-pulse-soft rounded-full bg-red-500" /> Recording · 0:12</Label>
    <Corners />
  </Photo>,
  <Photo key="ingest" src={SHALYA}>
    <div className="absolute inset-0 bg-[var(--ink)]/45 [mask-image:radial-gradient(ellipse_34%_30%_at_50%_34%,transparent_95%,#000_100%)]" />
    <div className="absolute left-1/2 top-[13%] h-[42%] w-[44%] -translate-x-1/2 rounded-2xl border-2 border-dashed border-white">
      <span className="absolute -top-3 left-3 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-white">Face found</span>
    </div>
    <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-[var(--bg)]/95 px-4 py-2.5">
      <p className="text-[12px] font-semibold text-[var(--muted)]">Clean audio</p>
      <Wave />
    </div>
    <Label>Background removed</Label>
  </Photo>,
  <div key="train" className="relative grid size-full place-items-center bg-[var(--surface)] [perspective:900px]">
    <div className="relative h-[62%] w-[66%] [transform-style:preserve-3d] [transform:rotateX(52deg)_rotateZ(-28deg)]">
      {[
        { t: 'Face', icon: ScanFace, z: 0 },
        { t: 'Voice', icon: AudioLines, z: 46 },
        { t: 'Digital twin', icon: Sparkles, z: 92 },
      ].map((l, k) => (
        <div
          key={l.t}
          className={cn('absolute inset-0 flex items-end rounded-2xl border p-4 shadow-[0_24px_40px_-24px_rgba(29,58,154,0.9)]', k === 2 ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--on-ink)]' : 'border-[var(--border)] bg-[var(--bg)] text-[var(--ink)]')}
          style={{ transform: `translateZ(${l.z}px)` }}
        >
          <span className="flex items-center gap-2 text-[14px] font-bold"><l.icon className="size-4" /> {l.t}</span>
        </div>
      ))}
    </div>
    <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--bg)] px-3 py-1.5 text-[12.5px] font-semibold ring-1 ring-[var(--border)]">Packaged into one reusable twin</span>
  </div>,
  <div key="gen" className="relative size-full">
    <video src="/avatars/clips/shalya_intro.mp4" poster={SHALYA} muted loop autoPlay playsInline preload="metadata" className="size-full object-cover" />
    <Label dark><Video className="size-3.5" /> Generated from a script</Label>
    <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-[var(--bg)]/95 px-4 py-3 text-[13px] text-[var(--ink)]">“Hi, I’m Shalya, a digital twin made from a two minute video.”</div>
  </div>,
  <div key="check" className="relative flex size-full flex-col bg-[var(--surface)] p-4">
    <p className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--accent)]">Consistency check</p>
    <div className="mt-3 grid flex-1 grid-cols-3 gap-2">
      {Array.from({ length: 9 }, (_, k) => (
        <div key={k} className="relative overflow-hidden rounded-xl">
          <img src={SHALYA} alt="" className="size-full object-cover" style={{ objectPosition: `${45 + (k % 3) * 5}% ${25 + Math.floor(k / 3) * 4}%` }} loading="lazy" />
          <span className={cn('absolute bottom-1 right-1 grid size-5 place-items-center rounded-full text-white', k === 7 ? 'bg-red-500' : 'bg-[var(--accent)]')}>
            {k === 7 ? <span className="text-[11px] font-bold">!</span> : <Check className="size-3" />}
          </span>
        </div>
      ))}
    </div>
    <p className="mt-3 text-[12.5px] text-[var(--muted)]">Frames that drift are flagged or rejected. <span className="text-[var(--muted)]/80">(Illustrative)</span></p>
  </div>,
]

/* Stage 2 faces: live session, slot-filling, flow, knowledge base, provisioning */
const SLOTS = ['Purpose', 'Who will call', 'What to collect', 'Workflow steps', 'Tools', 'Language']
export const BUILDER_FACES: ReactNode[] = [
  <div key="session" className="relative flex size-full flex-col items-center justify-center gap-5 bg-[var(--ink)] p-6 text-[var(--on-ink)]">
    <span className="grid size-20 place-items-center rounded-full bg-white/10 ring-8 ring-white/5"><Mic className="size-8" /></span>
    <Wave n={30} className="h-10 [&>span]:bg-white" />
    <p className="text-center text-[15px] leading-snug">“I need a receptionist for our office…”</p>
    <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold">Transcribing as you speak</span>
  </div>,
  <div key="slots" className="flex size-full flex-col bg-[var(--surface)] p-5">
    <p className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--accent)]">Filling in the details</p>
    <ul className="mt-4 space-y-2.5">
      {SLOTS.map((s, k) => (
        <li key={s} className={cn('flex items-center justify-between rounded-xl px-4 py-2.5 text-[14px] font-semibold', k < 4 ? 'bg-[var(--bg)] ring-1 ring-[var(--accent)]/40' : 'text-[var(--muted)] ring-1 ring-dashed ring-[var(--border)]')}>
          {s}
          {k < 4 ? <Check className="size-4 text-[var(--accent)]" /> : <span className="text-[12px] font-medium">asking…</span>}
        </li>
      ))}
    </ul>
  </div>,
  <div key="flow" className="flex size-full flex-col items-center justify-center gap-2 bg-[var(--surface)] p-5">
    <p className="mb-2 text-[12.5px] font-bold uppercase tracking-wider text-[var(--accent)]">Conversation flow</p>
    {['Greet', 'Answer questions', 'Book a meeting', 'Close'].map((n, k, a) => (
      <div key={n} className="flex flex-col items-center">
        <span className={cn('rounded-xl px-5 py-2.5 text-[14px] font-semibold shadow-[0_10px_20px_-14px_rgba(29,58,154,0.8)]', k === 0 || k === a.length - 1 ? 'bg-[var(--ink)] text-[var(--on-ink)]' : 'bg-[var(--bg)] ring-1 ring-[var(--border)]')}>{n}</span>
        {k < a.length - 1 && <span className="h-5 w-px bg-[var(--accent)]" />}
      </div>
    ))}
  </div>,
  <div key="kb" className="flex size-full flex-col justify-center gap-3 bg-[var(--surface)] p-5">
    <p className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--accent)]">Knowledge base</p>
    {['Services overview.pdf', 'Pricing.pdf', 'Opening hours.docx'].map((d, k) => (
      <div key={d} className="flex items-center gap-3 rounded-xl bg-[var(--bg)] px-4 py-3 ring-1 ring-[var(--border)]" style={{ transform: `translateX(${k * 10}px)` }}>
        <FileText className="size-5 text-[var(--accent)]" /> <span className="text-[14px] font-semibold">{d}</span>
        <Check className="ml-auto size-4 text-[var(--accent)]" />
      </div>
    ))}
    <p className="text-[12.5px] text-[var(--muted)]">Indexed and searched during conversations · Illustrative</p>
  </div>,
  <div key="prov" className="flex size-full flex-col bg-[var(--surface)] p-5">
    <p className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--accent)]">Agent ready</p>
    <div className="mt-4 flex flex-1 flex-col overflow-hidden rounded-2xl bg-[var(--bg)] ring-1 ring-[var(--border)]">
      <img src={ARIA} alt="" className="h-1/2 w-full object-cover" loading="lazy" />
      <div className="flex-1 space-y-2 p-4 text-[13.5px]">
        <p className="font-display text-[18px] font-bold">Receptionist</p>
        <p className="text-[var(--muted)]">Avatar: Aria · Voice: Aria</p>
        <div className="flex flex-wrap gap-1.5">
          {['Phone', 'Web', 'API'].map((c) => <span key={c} className="rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-[12px] font-semibold ring-1 ring-[var(--border)]">{c}</span>)}
          <span className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[12px] font-semibold text-white">Draft</span>
        </div>
      </div>
    </div>
  </div>,
]

