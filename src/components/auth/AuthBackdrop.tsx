import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'

const POINTS = [
  'Create an AI avatar from one short video',
  'Build an agent just by describing it',
  'Hold live conversations in your face and voice',
]

/** Right half of the split-screen sign-in / sign-up pages: a cobalt panel with the product message.
    Shown on large screens only. */
export function AuthPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-accent-strong text-on-accent lg:flex lg:flex-col lg:justify-center lg:px-16 xl:px-24">
      <span aria-hidden className="absolute -right-16 -top-16 h-72 w-60 rotate-12 rounded-[32px] border-[3px] border-white/25" />
      <span aria-hidden className="absolute -bottom-12 -left-12 size-56 rounded-full bg-white/10" />
      <div className="relative max-w-md">
        <p className="text-[13px] font-bold uppercase tracking-wider text-white/70">Rooman Agent</p>
        <h2 className="mt-5 font-display text-[44px] font-extrabold leading-[1.02] tracking-[-0.03em] !text-white xl:text-[52px]">
          Your face.
          <br />
          Your voice.
          <br />
          Your agent.
        </h2>
        <ul className="mt-10 space-y-4">
          {POINTS.map((p) => (
            <li key={p} className="flex items-start gap-3 text-[16px] leading-snug text-white/90">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/15">
                <Check className="size-3.5" aria-hidden />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

/** Rooman logo + "Agent" tag, linking home. */
export function AuthLogo() {
  return (
    <Link to="/" aria-label="Rooman Agent home" className="flex items-center gap-2.5">
      <img src="/images/rooman-logo.png" alt="Rooman" width={307} height={80} className="h-9 w-auto" />
      <span className="rounded-md bg-accent-strong px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider text-on-accent">Agent</span>
    </Link>
  )
}
