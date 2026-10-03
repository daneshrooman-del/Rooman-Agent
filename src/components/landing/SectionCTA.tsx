import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { TiltCard } from './TiltCard'

export function SectionCTA() {
  return (
    <section className="py-20 sm:py-28 relative overflow-hidden">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
        <TiltCard maxTilt={4} scale={1.01} className="w-full">
          <div className="relative rounded-[32px] overflow-hidden p-8 sm:p-14 lg:p-20 text-center border border-white/[0.12] bg-[#0c0c16]/90 shadow-[0_0_80px_-20px_rgba(122,99,255,0.45)] backdrop-blur-2xl">
            {/* Background subtle avatar watermark silhouette and ambient glow */}
            <div className="absolute inset-0 opacity-15 mix-blend-screen pointer-events-none overflow-hidden">
              <img
                src="/avatars/avatar_shalya.jpg"
                alt="AI Avatar Background"
                className="w-full h-full object-cover object-center filter blur-xl scale-125"
              />
            </div>

            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-accent/20 blur-3xl pointer-events-none rounded-full" />
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-1/2 h-32 bg-blue-500/15 blur-3xl pointer-events-none rounded-full" />

            <div className="relative z-10 max-w-2xl mx-auto space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.1] text-[12px] font-medium text-accent">
                <Sparkles className="size-3.5 text-accent" />
                <span className="uppercase tracking-wider">Get Started Today</span>
              </div>

              <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight">
                Create your{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#b3a2ff] via-[#8f7cff] to-[#5b8dff]">
                  AI avatar.
                </span>
              </h2>

              <p className="text-[16px] sm:text-[18px] text-fg-muted max-w-xl mx-auto leading-relaxed">
                Build videos, conversations and agents from one reusable identity.
              </p>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-[15px] font-semibold text-white bg-gradient-to-r from-[#7a63ff] via-[#8f7cff] to-[#5b8dff] hover:opacity-95 shadow-[0_0_35px_rgba(122,99,255,0.5)] hover:shadow-[0_0_50px_rgba(122,99,255,0.7)] transition-all duration-300"
                >
                  <span>Get started free</span>
                  <ArrowRight className="size-4" />
                </Link>

                <Link
                  to="/signin"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-[15px] font-semibold text-fg hover:text-white bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
                >
                  <span>Sign in to Dashboard</span>
                </Link>
              </div>
            </div>
          </div>
        </TiltCard>
      </div>
    </section>
  )
}
