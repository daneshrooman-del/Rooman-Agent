import { useState } from 'react'
import { ArrowRight, Play, Pause, Download, Wand2, Sparkles, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { TiltCard } from './TiltCard'
import { AVATAR_OPTIONS, type AvatarOption } from './HeroShowcase'

export function SectionGenerateVideo({
  avatar,
  onSelectAvatar,
}: {
  avatar: AvatarOption
  onSelectAvatar: (av: AvatarOption) => void
}) {
  const [script, setScript] = useState("Hey — welcome to our platform. Today I'll show you how it works.")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(45)
  const [activeTab, setActiveTab] = useState<'script' | 'voice'>('script')
  const [selectedVoice, setSelectedVoice] = useState('v_natural')

  const handleGenerate = () => {
    setIsGenerating(true)
    setTimeout(() => {
      setIsGenerating(false)
      setIsPlaying(true)
    }, 1200)
  }

  return (
    <section id="video-section" className="py-24 sm:py-32 relative overflow-hidden bg-white/[0.01]">
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-blue-500/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[12px] font-medium text-accent">
              <span className="font-mono text-accent/80">[02]</span>
              <span className="uppercase tracking-wider">Generate Video</span>
            </div>

            <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white leading-[1.12]">
              Write anything.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#b3a2ff] via-[#8f7cff] to-[#5b8dff]">
                Get a finished video.
              </span>
            </h2>

            <p className="text-[16px] sm:text-[17px] text-fg-muted leading-relaxed max-w-xl">
              Type a script and generate a high-quality video with your avatar. No camera, no reshoot. Deliver training, sales updates, and executive briefings at scale.
            </p>

            <div className="pt-2">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-[14px] font-semibold text-white bg-gradient-to-r from-[#7a63ff] to-[#8f7cff] hover:opacity-95 shadow-[0_0_30px_rgba(122,99,255,0.45)] hover:shadow-[0_0_40px_rgba(122,99,255,0.65)] transition-all duration-300"
              >
                <span>Try it now — free</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          {/* Right Interactive Mockup Container */}
          <div className="lg:col-span-7">
            <TiltCard maxTilt={5} scale={1.01} className="w-full">
              <div className="rounded-[24px] bg-[#0c0c14]/90 p-4 sm:p-5 border border-white/[0.12] shadow-[0_0_50px_rgba(122,99,255,0.2)] backdrop-blur-2xl">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
                  {/* Left Box: Script / Voice Editor */}
                  <div className="md:col-span-6 flex flex-col justify-between rounded-[18px] bg-[#12121c]/90 border border-white/[0.08] p-4">
                    <div>
                      {/* Editor Tabs */}
                      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-3">
                        <span className="text-[13px] font-semibold text-white">Your script</span>
                        <div className="flex items-center gap-1 bg-white/[0.05] p-0.5 rounded-lg border border-white/[0.06]">
                          <button
                            type="button"
                            onClick={() => setActiveTab('script')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                              activeTab === 'script' ? 'bg-accent text-white shadow-sm' : 'text-fg-muted hover:text-white'
                            }`}
                          >
                            Script
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('voice')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                              activeTab === 'voice' ? 'bg-accent text-white shadow-sm' : 'text-fg-muted hover:text-white'
                            }`}
                          >
                            Voice
                          </button>
                        </div>
                      </div>

                      {/* Content Area */}
                      {activeTab === 'script' ? (
                        <div className="relative">
                          <textarea
                            value={script}
                            onChange={(e) => setScript(e.target.value.slice(0, 500))}
                            placeholder="Enter what your avatar should say..."
                            rows={5}
                            className="w-full bg-white/[0.03] rounded-xl border border-white/[0.08] p-3 text-[13px] text-white placeholder-fg-subtle resize-none focus:outline-none focus:border-accent/60 leading-relaxed font-sans"
                          />
                          <div className="flex justify-between items-center mt-1.5 px-1">
                            <span className="text-[11px] text-accent/80 flex items-center gap-1">
                              <Sparkles className="size-3" /> AI Voice Synthesis Active
                            </span>
                            <span className="text-[11px] font-mono text-fg-muted">
                              {script.length}/500
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 py-2">
                          <label className="text-[12px] font-medium text-fg-muted">Voice Profile</label>
                          <div className="space-y-1.5">
                            {[
                              { id: 'v_natural', name: 'Shalya (Natural Tone)', lang: 'English (US)' },
                              { id: 'v_aria', name: 'Aria (Warm & Clear)', lang: 'English (UK)' },
                              { id: 'v_multilingual', name: 'Dev (Expressive)', lang: 'Hindi & English' },
                            ].map((v) => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => setSelectedVoice(v.id)}
                                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-[12px] transition-colors ${
                                  selectedVoice === v.id
                                    ? 'bg-accent/15 border-accent text-white'
                                    : 'bg-white/[0.02] border-white/[0.06] text-fg-muted hover:bg-white/[0.05]'
                                }`}
                              >
                                <div>
                                  <div className="font-semibold text-white">{v.name}</div>
                                  <div className="text-[10px] text-fg-subtle">{v.lang}</div>
                                </div>
                                {selectedVoice === v.id && <Check className="size-4 text-accent" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Generate Action Button */}
                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-[#7a63ff] to-[#8f7cff] hover:opacity-95 shadow-[0_0_24px_rgba(122,99,255,0.4)] disabled:opacity-50 transition-all"
                      >
                        {isGenerating ? (
                          <>
                            <Wand2 className="size-4 animate-spin text-white" />
                            <span>Rendering video...</span>
                          </>
                        ) : (
                          <>
                            <Wand2 className="size-4" />
                            <span>Generate video</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Right Box: Video Preview Player */}
                  <div className="md:col-span-6 flex flex-col justify-between rounded-[18px] bg-black/70 border border-white/[0.08] p-3 overflow-hidden">
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black group">
                      <img
                        src={avatar.image}
                        alt="Video Preview"
                        className="w-full h-full object-cover"
                      />

                      {/* Video Player Controls Overlay */}
                      <button
                        type="button"
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] hover:bg-black/20 transition-all"
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                      >
                        <div className="size-12 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-xl transition-transform group-hover:scale-110">
                          {isPlaying ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current ml-0.5" />}
                        </div>
                      </button>

                      {/* Resolution badge */}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] font-mono text-white/80">
                        Preview
                      </div>
                    </div>

                    {/* Timeline & Controls */}
                    <div className="pt-3 space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-mono text-fg-muted">
                        <span>00:14</span>
                        <span>00:32</span>
                      </div>

                      {/* Scrubber bar */}
                      <div
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100)
                          setProgress(pct)
                        }}
                        className="h-1.5 rounded-full bg-white/10 cursor-pointer overflow-hidden relative"
                      >
                        <div
                          className="h-full bg-gradient-to-r from-accent to-accent-2 rounded-full transition-all duration-150"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      {/* Bottom Bar: Export Button & Avatar Selection */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                          {AVATAR_OPTIONS.map((av) => (
                            <button
                              key={av.id}
                              type="button"
                              onClick={() => onSelectAvatar(av)}
                              className={`size-7 rounded-full overflow-hidden border transition-all ${
                                av.id === avatar.id ? 'border-accent scale-110 shadow-sm' : 'border-white/20 opacity-60 hover:opacity-100'
                              }`}
                              title={av.name}
                            >
                              <img src={av.image} alt={av.name} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>

                        <Link
                          to="/signup"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] transition-colors"
                        >
                          <Download className="size-3" />
                          <span>Export</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TiltCard>
          </div>
        </div>
      </div>
    </section>
  )
}
