import { ArrowRight, CheckCircle2, ChevronRight, Loader2, CircleDot } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ThreeOrb } from './ThreeOrb'
import { TiltCard } from './TiltCard'
import type { AvatarOption } from './HeroShowcase'

export function SectionCreateAvatar({ avatar }: { avatar: AvatarOption }) {
  return (
    <section id="avatar-section" className="py-24 sm:py-32 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-accent/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[12px] font-medium text-accent">
              <span className="font-mono text-accent/80">[01]</span>
              <span className="uppercase tracking-wider">Create Your Avatar</span>
            </div>

            <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white leading-[1.12]">
              One video.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#b3a2ff] via-[#8f7cff] to-[#5b8dff]">
                One digital identity.
              </span>
            </h2>

            <p className="text-[16px] sm:text-[17px] text-fg-muted leading-relaxed max-w-xl">
              Upload a short reference video and create a reusable AI avatar that looks and sounds like you. Never sit in front of a camera again.
            </p>

            <div className="pt-2">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-[14px] font-semibold text-white bg-gradient-to-r from-[#7a63ff] to-[#8f7cff] hover:opacity-95 shadow-[0_0_30px_rgba(122,99,255,0.45)] hover:shadow-[0_0_40px_rgba(122,99,255,0.65)] transition-all duration-300"
              >
                <span>Get started free</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          {/* Right Pipeline Cards */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-3 items-center relative">
              {/* Card 1: Record or upload */}
              <TiltCard maxTilt={8} className="h-full">
                <div className="h-full rounded-[22px] bg-[#0d0d16]/90 border border-white/[0.1] p-3 sm:p-4 shadow-xl backdrop-blur-xl flex flex-col justify-between group hover:border-accent/40 transition-colors">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[12px] font-semibold text-white">Record or upload</span>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-mono">
                        <span className="size-1.5 rounded-full bg-red-500 animate-ping" />
                        REC
                      </div>
                    </div>

                    {/* Viewfinder frame */}
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-black/60 border border-white/[0.08]">
                      <img
                        src={avatar.image}
                        alt="Record source"
                        className="w-full h-full object-cover grayscale contrast-125 filter group-hover:grayscale-0 transition-all duration-500"
                      />
                      {/* Viewfinder corner brackets */}
                      <div className="absolute top-2 left-2 size-3 border-t-2 border-l-2 border-white/60" />
                      <div className="absolute top-2 right-2 size-3 border-t-2 border-r-2 border-white/60" />
                      <div className="absolute bottom-2 left-2 size-3 border-b-2 border-l-2 border-white/60" />
                      <div className="absolute bottom-2 right-2 size-3 border-b-2 border-r-2 border-white/60" />

                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-mono text-white/90">
                        00:45 / 02:00
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] text-fg-muted text-center">
                    2 min studio footage · 4K resolution
                  </p>
                </div>
              </TiltCard>

              {/* Connecting Arrow 1 */}
              <div className="hidden md:flex absolute left-[32%] top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 size-7 rounded-full bg-[#171724] border border-white/20 items-center justify-center text-accent shadow-lg pointer-events-none">
                <ChevronRight className="size-4" />
              </div>

              {/* Card 2: Creating your AI avatar (with 3D Three.js Orb!) */}
              <TiltCard maxTilt={8} className="h-full">
                <div className="h-full rounded-[22px] bg-[#0e0e1a]/95 border border-accent/40 p-3 sm:p-4 shadow-[0_0_35px_rgba(122,99,255,0.25)] backdrop-blur-xl flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute -top-12 -left-12 size-32 bg-accent/25 rounded-full blur-2xl pointer-events-none" />

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-semibold text-white">Creating your AI avatar...</span>
                    </div>

                    {/* Real 3D Interactive WebGL Orb */}
                    <div className="my-1">
                      <ThreeOrb progress={72} className="py-1" />
                    </div>

                    {/* Progress Checklist */}
                    <div className="space-y-1.5 pt-1 text-[11px]">
                      <div className="flex items-center gap-2 text-white">
                        <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                        <span>Analyzing features</span>
                      </div>
                      <div className="flex items-center gap-2 text-white">
                        <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                        <span>Training identity</span>
                      </div>
                      <div className="flex items-center gap-2 text-accent font-medium">
                        <Loader2 className="size-3.5 text-accent animate-spin shrink-0" />
                        <span>Optimizing voice</span>
                      </div>
                      <div className="flex items-center gap-2 text-fg-muted">
                        <CircleDot className="size-3.5 text-fg-subtle shrink-0" />
                        <span>Almost ready...</span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-[10px] text-accent/80 text-center font-mono">
                    Deep neural checkpoint 4,200/5,000
                  </p>
                </div>
              </TiltCard>

              {/* Connecting Arrow 2 */}
              <div className="hidden md:flex absolute left-[67%] top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 size-7 rounded-full bg-[#171724] border border-white/20 items-center justify-center text-accent shadow-lg pointer-events-none">
                <ChevronRight className="size-4" />
              </div>

              {/* Card 3: Your AI avatar */}
              <TiltCard maxTilt={8} className="h-full">
                <div className="h-full rounded-[22px] bg-[#0d0d16]/90 border border-white/[0.1] p-3 sm:p-4 shadow-xl backdrop-blur-xl flex flex-col justify-between group hover:border-emerald-500/40 transition-colors">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[12px] font-semibold text-white">Your AI avatar</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        Ready
                      </span>
                    </div>

                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-black/60 border border-white/[0.08]">
                      <img
                        src={avatar.image}
                        alt="Your AI Avatar"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                      <div className="absolute bottom-2.5 left-2.5 right-2.5">
                        <div className="text-[12px] font-bold text-white">{avatar.name}</div>
                        <div className="text-[10px] text-accent">Active Digital Twin</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-fg-muted px-1">
                    <span>Lip-sync accuracy</span>
                    <span className="text-emerald-400 font-mono font-semibold">99.8%</span>
                  </div>
                </div>
              </TiltCard>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
