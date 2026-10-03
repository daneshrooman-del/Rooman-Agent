import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Play, CheckCircle2 } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { LandingNavbar } from '@/components/landing/LandingNavbar'
import { ThreeHeroBackdrop } from '@/components/landing/ThreeHeroBackdrop'
import { HeroShowcase, AVATAR_OPTIONS, type AvatarOption } from '@/components/landing/HeroShowcase'
import { SectionCreateAvatar } from '@/components/landing/SectionCreateAvatar'
import { SectionGenerateVideo } from '@/components/landing/SectionGenerateVideo'
import { SectionLiveConversation } from '@/components/landing/SectionLiveConversation'
import { SectionBuildAgent } from '@/components/landing/SectionBuildAgent'
import { SectionFAQ } from '@/components/landing/SectionFAQ'
import { SectionCTA } from '@/components/landing/SectionCTA'
import { LandingFooter } from '@/components/landing/LandingFooter'

export default function LandingPage() {
  useDocumentTitle('Rooman Agent — AI Avatar, Video & Autonomous Agents')
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarOption>(AVATAR_OPTIONS[0])

  return (
    <div className="min-h-screen bg-[#05050d] text-fg selection:bg-accent/30 selection:text-white relative overflow-x-hidden font-sans">
      {/* Star field texture */}
      <div className="star-field" />
      {/* Fixed Sticky Header Navbar */}
      <LandingNavbar />

      {/* Hero Section */}
      <section className="relative pt-32 sm:pt-40 pb-20 sm:pb-28 overflow-hidden">
        {/* Interactive 3D Three.js Particle Mesh Background */}
        <ThreeHeroBackdrop />

        {/* Ambient Top Glow Orbs */}
        <div className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-accent/20 blur-[150px] rounded-full" />
        <div className="pointer-events-none absolute top-36 right-10 w-[450px] h-[450px] bg-blue-600/10 blur-[160px] rounded-full" />

        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
            {/* Left Hero Content */}
            <div className="lg:col-span-6 space-y-6 sm:space-y-8 animate-fade-up">
              {/* Main Headline */}
              <h1 className="font-display text-5xl sm:text-6xl lg:text-[68px] font-bold tracking-tight text-white leading-[1.08]">
                Turn your video into{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#b3a2ff] via-[#8f7cff] to-[#5b8dff]">
                  an AI Avatar.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-[17px] sm:text-[19px] text-fg-muted font-normal max-w-xl leading-relaxed">
                Create a digital twin that can generate videos, speak live, and power intelligent AI agents.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 px-6 sm:px-7 py-3.5 sm:py-4 rounded-xl text-[14px] sm:text-[15px] font-semibold text-white bg-gradient-to-r from-[#7a63ff] via-[#8f7cff] to-[#5b8dff] hover:opacity-95 shadow-[0_0_35px_rgba(122,99,255,0.45)] hover:shadow-[0_0_45px_rgba(122,99,255,0.65)] transition-all duration-300"
                >
                  <span>Create your avatar — free</span>
                  <ArrowRight className="size-4" />
                </Link>

                <a
                  href="#avatar-section"
                  className="inline-flex items-center gap-2 px-5 sm:px-6 py-3.5 sm:py-4 rounded-xl text-[14px] sm:text-[15px] font-semibold text-fg hover:text-white bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
                >
                  <Play className="size-3.5 fill-current" />
                  <span>See how it works</span>
                </a>
              </div>

              {/* Key Bullet Pills */}
              <div className="pt-4 space-y-2.5 sm:space-y-3">
                <div className="flex items-center gap-3 text-[13px] sm:text-[14px] text-fg-muted">
                  <div className="size-5 rounded-full bg-accent/15 flex items-center justify-center text-accent shrink-0">
                    <CheckCircle2 className="size-3.5" />
                  </div>
                  <span>Same identity across all outputs</span>
                </div>

                <div className="flex items-center gap-3 text-[13px] sm:text-[14px] text-fg-muted">
                  <div className="size-5 rounded-full bg-accent/15 flex items-center justify-center text-accent shrink-0">
                    <CheckCircle2 className="size-3.5" />
                  </div>
                  <span>Videos, live calls and agents in one platform</span>
                </div>

                <div className="flex items-center gap-3 text-[13px] sm:text-[14px] text-fg-muted">
                  <div className="size-5 rounded-full bg-accent/15 flex items-center justify-center text-accent shrink-0">
                    <CheckCircle2 className="size-3.5" />
                  </div>
                  <span>Built with privacy and user control</span>
                </div>
              </div>
            </div>

            {/* Right Hero Interactive 3D Showcase */}
            <div className="lg:col-span-6 animate-fade-in">
              <HeroShowcase
                selectedAvatar={selectedAvatar}
                onSelectAvatar={setSelectedAvatar}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Section 01: Create Your Avatar (with 3D Rotating Three.js Orb!) */}
      <SectionCreateAvatar avatar={selectedAvatar} />

      {/* Section 02: Generate Video */}
      <SectionGenerateVideo
        avatar={selectedAvatar}
        onSelectAvatar={setSelectedAvatar}
      />

      {/* Section 03: Live Conversation */}
      <SectionLiveConversation avatar={selectedAvatar} />

      {/* Section 04: Build An Agent */}
      <SectionBuildAgent />

      {/* Section 05: Frequently Asked Questions */}
      <SectionFAQ />

      {/* Section 06: Get Started Today Banner */}
      <SectionCTA />

      {/* Footer */}
      <LandingFooter />
    </div>
  )
}
