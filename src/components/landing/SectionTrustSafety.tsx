import { ShieldCheck, UserCheck, Lock } from 'lucide-react'
import { TiltCard } from './TiltCard'

const TRUST_FEATURES = [
  {
    title: 'Consent required',
    desc: 'Every avatar needs an on-camera consent step.',
    detail: 'Biometric liveness verification and spoken phrase matching prevent impersonation or unauthorized deepfakes.',
    icon: ShieldCheck,
    badge: 'Vocal Liveness',
  },
  {
    title: 'Verified identity',
    desc: 'We check every upload for safety and authenticity.',
    detail: 'Cryptographic C2PA digital watermarks and provenance signatures ensure synthetic media transparency.',
    icon: UserCheck,
    badge: 'C2PA Signed',
  },
  {
    title: 'Your data, your control',
    desc: 'You can manage or delete your avatar at any time.',
    detail: 'One-click full model purge. Your voice prints and reference videos are never used to train third-party foundation models.',
    icon: Lock,
    badge: 'Zero Retention Option',
  },
]

export function SectionTrustSafety() {
  return (
    <section id="trust-section" className="py-24 sm:py-32 relative overflow-hidden">
      {/* Centered purple glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-accent/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[12px] font-medium text-accent">
            <span className="uppercase tracking-wider">Trust & Safety</span>
          </div>

          <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
            Built on consent,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#b3a2ff] via-[#8f7cff] to-[#5b8dff]">
              not shortcuts.
            </span>
          </h2>

          <p className="text-[16px] sm:text-[17px] text-fg-muted leading-relaxed">
            Your data stays yours. Every step respects your identity and privacy.
          </p>
        </div>

        {/* 3 Glass Tilt Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TRUST_FEATURES.map((item, idx) => {
            const Icon = item.icon
            return (
              <TiltCard key={idx} maxTilt={6} className="h-full">
                <div className="h-full rounded-[24px] bg-[#0c0c14]/85 border border-white/[0.09] p-6 sm:p-7 shadow-xl backdrop-blur-2xl flex flex-col justify-between group hover:border-accent/40 hover:shadow-[0_0_35px_rgba(122,99,255,0.2)] transition-all duration-300">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="size-11 rounded-xl bg-accent-soft border border-accent/20 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
                        <Icon className="size-5" />
                      </div>
                      <span className="text-[10px] font-mono text-accent/80 px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
                        {item.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-[18px] font-bold text-white mb-2">{item.title}</h3>
                      <p className="text-[14px] text-fg font-medium mb-2">{item.desc}</p>
                      <p className="text-[13px] text-fg-muted leading-relaxed">{item.detail}</p>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-fg-subtle">
                    <span>Enterprise Grade</span>
                    <span className="text-emerald-400">SOC2 Type II Ready</span>
                  </div>
                </div>
              </TiltCard>
            )
          })}
        </div>
      </div>
    </section>
  )
}
