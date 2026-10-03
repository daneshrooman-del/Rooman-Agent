import { useState, useEffect } from 'react'
import { Play, Pause, Plus, Check, Volume2, VolumeX, Sparkles, Video, Radio, Bot } from 'lucide-react'
import { TiltCard } from './TiltCard'

export interface AvatarOption {
  id: string
  name: string
  role: string
  image: string
  color: string
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  {
    id: 'shalya',
    name: 'Shalya',
    role: 'Digital Twin',
    image: '/avatars/avatar_shalya.jpg',
    color: '#8f7cff',
  },
  {
    id: 'aria',
    name: 'Aria',
    role: 'Brand Presenter',
    image: '/avatars/avatar_aria.jpg',
    color: '#5b8dff',
  },
  {
    id: 'dev',
    name: 'Dev',
    role: 'Tech Lead Twin',
    image: '/avatars/avatar_dev.jpg',
    color: '#3ed598',
  },
]

type HeroTab = 'create' | 'video' | 'live' | 'agent'

export function HeroShowcase({
  selectedAvatar,
  onSelectAvatar,
}: {
  selectedAvatar: AvatarOption
  onSelectAvatar: (av: AvatarOption) => void
}) {
  const [activeTab, setActiveTab] = useState<HeroTab>('live')
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(true)
  const [pulseLevel, setPulseLevel] = useState(0.5)

  // Gentle audio wave pulse simulation
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setPulseLevel(0.3 + Math.random() * 0.7)
    }, 150)
    return () => clearInterval(interval)
  }, [isPlaying])

  return (
    <TiltCard maxTilt={6} scale={1.01} className="w-full max-w-[640px] mx-auto">
      <div className="relative rounded-[24px] bg-[#0c0c14]/90 p-3 sm:p-4 border border-white/[0.12] shadow-[0_0_60px_-15px_rgba(122,99,255,0.35)] backdrop-blur-2xl">
        {/* Ambient Top Glow */}
        <div className="absolute -top-10 left-1/4 right-1/4 h-20 bg-accent/20 blur-3xl rounded-full pointer-events-none" />

        {/* Inner Grid Showcase */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-stretch">
          {/* Main Video Screen */}
          <div className="sm:col-span-8 flex flex-col justify-between rounded-[18px] bg-black/60 border border-white/[0.08] overflow-hidden relative group min-h-[300px] sm:min-h-[360px]">
            {/* Top Bar with Live Tag */}
            <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-medium text-white shadow-lg">
                <span className="size-2 rounded-full bg-red-500 animate-pulse" />
                <span>Live preview</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-md text-[10px] font-mono text-white/80">
                1080p · 60fps
              </div>
            </div>

            {/* Avatar Video / Visual Simulation */}
            <div className="relative w-full h-full flex-1 overflow-hidden">
              <img
                src={selectedAvatar.image}
                alt={selectedAvatar.name}
                className={`w-full h-full object-cover object-top transition-transform duration-700 ease-out-soft ${
                  isPlaying ? 'scale-105' : 'scale-100 filter brightness-90'
                }`}
              />

              {/* Holographic scanner / scanline overlay */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30" />

              {/* Interactive Audio reactive speech halo */}
              {isPlaying && (
                <div
                  className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 rounded-full border border-accent/40 blur-sm transition-all duration-200"
                  style={{
                    width: `${120 + pulseLevel * 60}px`,
                    height: `${40 + pulseLevel * 20}px`,
                    boxShadow: `0 0 ${20 + pulseLevel * 30}px rgba(143,124,255,0.6)`,
                  }}
                />
              )}

              {/* Play / Pause Interactive Overlay Button */}
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
              >
                <div className="size-14 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-2xl transition-transform duration-200 group-hover:scale-110 active:scale-95">
                  {isPlaying ? <Pause className="size-6 fill-current" /> : <Play className="size-6 fill-current ml-0.5" />}
                </div>
              </button>

              {/* Sound toggle button */}
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="absolute bottom-3 right-3 z-20 size-8 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4 text-accent" />}
              </button>
            </div>

            {/* Bottom Avatar Selection Bar */}
            <div className="relative z-20 px-3 py-2.5 bg-[#0a0a10]/90 backdrop-blur-md border-t border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                {AVATAR_OPTIONS.map((av) => {
                  const isSelected = av.id === selectedAvatar.id
                  return (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => onSelectAvatar(av)}
                      className={`relative size-9 rounded-full overflow-hidden transition-all duration-200 p-[1.5px] ${
                        isSelected
                          ? 'ring-2 ring-accent scale-105 shadow-[0_0_12px_rgba(143,124,255,0.7)]'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                      title={av.name}
                    >
                      <img src={av.image} alt={av.name} className="w-full h-full object-cover rounded-full" />
                      {isSelected && (
                        <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                          <Check className="size-3 text-white drop-shadow" />
                        </div>
                      )}
                    </button>
                  )
                })}

                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('avatar-section')
                    el?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="size-9 rounded-full border border-dashed border-white/25 flex items-center justify-center text-white/60 hover:text-white hover:border-accent transition-colors"
                  title="Create new avatar"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              <div className="text-right">
                <div className="text-[12px] font-semibold text-white leading-tight">{selectedAvatar.name}</div>
                <div className="text-[10px] text-accent leading-tight">{selectedAvatar.role}</div>
              </div>
            </div>
          </div>

          {/* Right Action Sidebar in Mockup */}
          <div className="sm:col-span-4 flex flex-col justify-between gap-2">
            {/* Tab 1: Create Avatar */}
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`p-3 rounded-xl text-left border transition-all duration-200 ${
                activeTab === 'create'
                  ? 'bg-accent/15 border-accent/60 shadow-[0_0_20px_rgba(143,124,255,0.25)]'
                  : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.06] hover:border-white/[0.12]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className={`size-4 ${activeTab === 'create' ? 'text-accent' : 'text-fg-muted'}`} />
                <span className="text-[13px] font-semibold text-white">Create Avatar</span>
              </div>
              <p className="text-[11px] text-fg-muted leading-tight">Upload a short video</p>
            </button>

            {/* Tab 2: Generate Video */}
            <button
              type="button"
              onClick={() => setActiveTab('video')}
              className={`p-3 rounded-xl text-left border transition-all duration-200 ${
                activeTab === 'video'
                  ? 'bg-accent/15 border-accent/60 shadow-[0_0_20px_rgba(143,124,255,0.25)]'
                  : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.06] hover:border-white/[0.12]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Video className={`size-4 ${activeTab === 'video' ? 'text-accent' : 'text-fg-muted'}`} />
                <span className="text-[13px] font-semibold text-white">Generate Video</span>
              </div>
              <p className="text-[11px] text-fg-muted leading-tight">Type a script</p>
            </button>

            {/* Tab 3: Live Conversation */}
            <button
              type="button"
              onClick={() => setActiveTab('live')}
              className={`p-3 rounded-xl text-left border transition-all duration-200 ${
                activeTab === 'live'
                  ? 'bg-accent/15 border-accent/60 shadow-[0_0_20px_rgba(143,124,255,0.25)]'
                  : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.06] hover:border-white/[0.12]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Radio className={`size-4 ${activeTab === 'live' ? 'text-accent' : 'text-fg-muted'}`} />
                <span className="text-[13px] font-semibold text-white">Live Conversation</span>
              </div>
              <p className="text-[11px] text-fg-muted leading-tight">Talk in real time</p>
            </button>

            {/* Tab 4: Build an Agent */}
            <button
              type="button"
              onClick={() => setActiveTab('agent')}
              className={`p-3 rounded-xl text-left border transition-all duration-200 ${
                activeTab === 'agent'
                  ? 'bg-accent/15 border-accent/60 shadow-[0_0_20px_rgba(143,124,255,0.25)]'
                  : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.06] hover:border-white/[0.12]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Bot className={`size-4 ${activeTab === 'agent' ? 'text-accent' : 'text-fg-muted'}`} />
                <span className="text-[13px] font-semibold text-white">Build an Agent</span>
              </div>
              <p className="text-[11px] text-fg-muted leading-tight">Describe your needs</p>
            </button>
          </div>
        </div>
      </div>
    </TiltCard>
  )
}
