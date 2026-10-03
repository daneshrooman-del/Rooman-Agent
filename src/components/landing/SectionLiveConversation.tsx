import { useState, useEffect } from 'react'
import { ArrowRight, Mic, Sparkles, User, Bot } from 'lucide-react'
import { Link } from 'react-router-dom'
import { TiltCard } from './TiltCard'
import type { AvatarOption } from './HeroShowcase'

interface DialogTurn {
  userPrompt: string
  avatarReply: string
}

const DIALOG_PRESETS: DialogTurn[] = [
  {
    userPrompt: 'Can you explain your pricing?',
    avatarReply: "Sure! I'd be happy to explain our plans and help you choose the best one.",
  },
  {
    userPrompt: 'Can I connect my company knowledge base?',
    avatarReply: 'Yes, absolutely. You can upload PDFs, Notion docs, or sync your website directly.',
  },
  {
    userPrompt: 'What is the real-time latency for live calls?',
    avatarReply: 'Under 350ms end-to-end via WebRTC streaming with full emotion-aware lip sync.',
  },
]

export function SectionLiveConversation({ avatar }: { avatar: AvatarOption }) {
  const [activeTurnIndex, setActiveTurnIndex] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const activeTurn = DIALOG_PRESETS[activeTurnIndex]

  // Simulate speaking waveform when turn changes
  useEffect(() => {
    setIsSpeaking(true)
    const t = setTimeout(() => setIsSpeaking(false), 2400)
    return () => clearTimeout(t)
  }, [activeTurnIndex])

  return (
    <section id="live-section" className="py-24 sm:py-32 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[550px] h-[550px] bg-accent/15 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Graphic: Interactive Live Video Call & Speech Bubbles */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <TiltCard maxTilt={5} scale={1.01} className="w-full">
              <div className="relative rounded-[24px] bg-[#0c0c14]/90 p-4 sm:p-5 border border-white/[0.12] shadow-[0_0_60px_-10px_rgba(124,94,255,0.3)] backdrop-blur-2xl">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Left Avatar Video Frame */}
                  <div className="md:col-span-6 relative aspect-[4/3] rounded-[18px] overflow-hidden bg-black/60 border border-white/[0.08] shadow-inner">
                    <img
                      src={avatar.image}
                      alt={avatar.name}
                      className="w-full h-full object-cover object-top"
                    />

                    {/* Gradient shade */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                    {/* Status pill at bottom left: "● Listening..." / "● Speaking..." */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/10 shadow-lg">
                      {isSpeaking ? (
                        <>
                          <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                          <span className="text-[11px] font-semibold text-white">Speaking...</span>
                          {/* Animated equalizer waves */}
                          <div className="flex items-center gap-0.5 ml-1 h-3">
                            <span className="w-0.5 h-full bg-emerald-400 rounded-full animate-wave" style={{ animationDelay: '0ms' }} />
                            <span className="w-0.5 h-2/3 bg-emerald-400 rounded-full animate-wave" style={{ animationDelay: '150ms' }} />
                            <span className="w-0.5 h-full bg-emerald-400 rounded-full animate-wave" style={{ animationDelay: '300ms' }} />
                            <span className="w-0.5 h-1/2 bg-emerald-400 rounded-full animate-wave" style={{ animationDelay: '450ms' }} />
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="size-2 rounded-full bg-accent animate-pulse" />
                          <span className="text-[11px] font-medium text-white/90">Listening...</span>
                          <Mic className="size-3 text-accent ml-0.5" />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Chat Bubbles in live call */}
                  <div className="md:col-span-6 space-y-3">
                    {/* User Message Bubble */}
                    <div className="flex items-start justify-end gap-2">
                      <div className="max-w-[90%] rounded-2xl rounded-tr-sm bg-[#222234] border border-white/[0.08] p-3 shadow-md">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-[11px] font-medium text-white/60">Candidate / Client</span>
                          <User className="size-3 text-white/50" />
                        </div>
                        <p className="text-[13px] text-white font-medium leading-snug">
                          {activeTurn.userPrompt}
                        </p>
                      </div>
                    </div>

                    {/* Avatar Response Bubble */}
                    <div className="flex items-start gap-2">
                      <div className="size-7 rounded-full bg-gradient-to-tr from-accent to-accent-2 flex items-center justify-center shrink-0 mt-1 shadow-md">
                        <Bot className="size-4 text-white" />
                      </div>
                      <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-gradient-to-br from-[#1c1c2a] to-[#141420] border border-accent/30 p-3 shadow-[0_4px_20px_rgba(124,94,255,0.15)]">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-[11px] font-semibold text-accent">{avatar.name} (AI Avatar)</span>
                          <Sparkles className="size-3 text-accent" />
                        </div>
                        <p className="text-[13px] text-fg leading-relaxed">
                          {activeTurn.avatarReply}
                        </p>
                      </div>
                    </div>

                    {/* Interactive prompts pills */}
                    <div className="pt-2">
                      <div className="text-[10px] uppercase font-mono tracking-wider text-fg-subtle mb-1.5">
                        Click prompt to test response:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {DIALOG_PRESETS.map((turn, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setActiveTurnIndex(i)}
                            className={`px-2.5 py-1 rounded-full text-[11px] transition-colors border ${
                              activeTurnIndex === i
                                ? 'bg-accent/20 border-accent text-white font-semibold'
                                : 'bg-white/[0.03] border-white/[0.08] text-fg-muted hover:text-white hover:bg-white/[0.06]'
                            }`}
                          >
                            {turn.userPrompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TiltCard>
          </div>

          {/* Right Text Column */}
          <div className="lg:col-span-5 space-y-6 order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[12px] font-medium text-accent">
              <span className="font-mono text-accent/80">[03]</span>
              <span className="uppercase tracking-wider">Live Conversation</span>
            </div>

            <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white leading-[1.12]">
              Not just a video.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8f7cff] via-[#6ba0ff] to-[#5b8dff]">
                A conversation.
              </span>
            </h2>

            <p className="text-[16px] sm:text-[17px] text-fg-muted leading-relaxed max-w-xl">
              Bring your avatar to life with real-time voice and video conversations. Conduct interviews, assist customers, and explain complex solutions with sub-second latency.
            </p>

            <div className="pt-2">
              <Link
                to="/live"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-[14px] font-semibold text-white bg-gradient-to-r from-[#7a63ff] to-[#8f7cff] hover:opacity-95 shadow-[0_0_30px_rgba(122,99,255,0.45)] hover:shadow-[0_0_40px_rgba(122,99,255,0.65)] transition-all duration-300"
              >
                <span>See live demo</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
