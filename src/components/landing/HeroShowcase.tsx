import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Plus, Check, Volume2, VolumeX, Sparkles, Video, Radio, Bot } from 'lucide-react'
import { TiltCard } from './TiltCard'
import { AvatarVideo } from './AvatarVideo'
import { WordCaption, useClipWords, useCurrentWord } from './WordCaption'
import clips from './avatarClips.json'

export interface AvatarOption {
  id: string
  name: string
  role: string
  image: string
  /** Real talking-head clip (tools/lipsync/avatar_clips.py); falls back to the still portrait. */
  video?: string
  /** The frame every clip of this avatar starts and ends on, in the shared camera framing. */
  rest?: string
  color: string
  /** What the avatar says in its intro clip. */
  line: string
}

const clipLines = clips.lines as Record<string, Record<string, string>>
export const clipUrl = (avatarId: string, key: string) => `/avatars/clips/${avatarId}_${key}.mp4`

const avatar = (id: string, name: string, role: string, color: string): AvatarOption => ({
  id,
  name,
  role,
  color,
  image: `/avatars/avatar_${id}.jpg`,
  video: clipUrl(id, 'intro'),
  rest: `/avatars/clips/${id}_rest.jpg`,
  line: clipLines[id].intro,
})

export const AVATAR_OPTIONS: AvatarOption[] = [
  avatar('shalya', 'Shalya', 'Digital Twin', '#c8501f'),
  avatar('aria', 'Aria', 'Brand Presenter', '#1f6b5a'),
  avatar('dev', 'Dev', 'Tech Lead Twin', '#2f5d8a'),
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
  const [progress, setProgress] = useState(0)
  const [hasClip, setHasClip] = useState(false)
  const [pulseLevel, setPulseLevel] = useState(0.5)
  const videoRef = useRef<HTMLVideoElement>(null)
  const words = useClipWords(hasClip ? selectedAvatar.video : undefined)
  const currentWord = useCurrentWord(videoRef, words, selectedAvatar.video)

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
      <div data-demo="hero-card" className="relative rounded-[24px] bg-surface/90 p-3 sm:p-4 border border-line-strong shadow-[0_0_60px_-15px_rgb(var(--rgb-accent)/0.35)] backdrop-blur-2xl">
        {/* Ambient Top Glow */}

        {/* Inner Grid Showcase */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-stretch">
          {/* Main Video Screen */}
          <div className="sm:col-span-8 flex flex-col rounded-[18px] bg-surface-3 border border-line overflow-hidden relative group">
            {/* Top Bar with Live Tag */}
            <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-medium text-white shadow-lg">
                <span className="size-2 rounded-full bg-red-500 animate-pulse" />
                <span>Live preview</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-md text-[10px] font-mono text-white/80">
                AI lip-sync
              </div>
            </div>

            {/* Avatar Video / Visual Simulation */}
            {/* fixed 4:5 frame: the card keeps one size and shape whatever clip is playing */}
            <div className="relative w-full aspect-[4/5] overflow-hidden">
              <AvatarVideo
                avatar={selectedAvatar}
                playing={isPlaying}
                muted={isMuted}
                videoRef={videoRef}
                onAutoplayBlocked={() => setIsMuted(true)}
                onClipChange={setHasClip}
                onTimeUpdate={(t, d) => setProgress(d ? t / d : 0)}
                className={isPlaying ? '' : 'brightness-90'}
              />

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

              {/* Interactive Audio reactive speech halo */}
              {isPlaying && (
                <div
                  className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 rounded-full border border-accent/40 blur-sm transition-all duration-200"
                  style={{
                    width: `${120 + pulseLevel * 60}px`,
                    height: `${40 + pulseLevel * 20}px`,
                    boxShadow: `0 0 ${20 + pulseLevel * 30}px rgb(var(--rgb-accent) / 0.6)`,
                  }}
                />
              )}

              {/* Captions: each word lights up as it is spoken (timings measured from the clip's audio) */}
              {hasClip && <WordCaption words={words} current={currentWord} className="absolute bottom-14 left-3 right-3 z-10" />}

              {/* Playback position */}
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-[3px] bg-white/10">
                <div className="h-full bg-accent transition-[width] duration-200 ease-linear" style={{ width: `${progress * 100}%` }} />
              </div>

              {/* Play / Pause — big button only when paused, so it never covers the face while talking */}
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className={`absolute inset-0 flex items-center justify-center transition-colors duration-300 ${isPlaying ? 'bg-transparent' : 'bg-black/25'}`}
                aria-label={isPlaying ? 'Pause video' : 'Play video'}
              >
                {isPlaying ? (
                  <span className="absolute bottom-3 left-3 z-20 size-8 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 opacity-70 group-hover:opacity-100 transition-opacity">
                    <Pause className="size-3.5 fill-current" />
                  </span>
                ) : (
                  <span className="size-14 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-2xl transition-transform duration-200 group-hover:scale-110 active:scale-95">
                    <Play className="size-6 fill-current ml-0.5" />
                  </span>
                )}
              </button>

              {/* Sound toggle — only when a real clip (with audio) is playing */}
              {hasClip && (
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="absolute bottom-3 right-3 z-20 size-8 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                title={isMuted ? 'Turn sound on' : 'Mute'}
              >
                {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4 text-accent" />}
                {isMuted && <span className="pointer-events-none absolute right-10 whitespace-nowrap rounded-md bg-black/60 px-2 py-1 text-[10px] text-white/80 opacity-0 transition-opacity group-hover:opacity-100">Tap for sound</span>}
              </button>
              )}
            </div>

            {/* Bottom Avatar Selection Bar */}
            <div className="relative z-20 px-3 py-2.5 bg-surface/90 backdrop-blur-md border-t border-line flex items-center justify-between">
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
                          ? 'ring-2 ring-accent scale-105 shadow-[0_0_12px_rgb(var(--rgb-accent)/0.7)]'
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
                  className="size-9 rounded-full border border-dashed border-fg/25 flex items-center justify-center text-fg/60 hover:text-fg hover:border-accent transition-colors"
                  title="Create new avatar"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              <div className="text-right">
                <div className="text-[12px] font-semibold text-fg leading-tight">{selectedAvatar.name}</div>
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
                  ? 'bg-accent/15 border-accent/60 shadow-[0_0_20px_rgb(var(--rgb-accent)/0.25)]'
                  : 'bg-fg/[0.03] border-line hover:bg-fg/[0.06] hover:border-line-strong'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className={`size-4 ${activeTab === 'create' ? 'text-accent' : 'text-fg-muted'}`} />
                <span className="text-[13px] font-semibold text-fg">Create Avatar</span>
              </div>
              <p className="text-[11px] text-fg-muted leading-tight">Upload a short video</p>
            </button>

            {/* Tab 2: Generate Video */}
            <button
              type="button"
              onClick={() => setActiveTab('video')}
              className={`p-3 rounded-xl text-left border transition-all duration-200 ${
                activeTab === 'video'
                  ? 'bg-accent/15 border-accent/60 shadow-[0_0_20px_rgb(var(--rgb-accent)/0.25)]'
                  : 'bg-fg/[0.03] border-line hover:bg-fg/[0.06] hover:border-line-strong'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Video className={`size-4 ${activeTab === 'video' ? 'text-accent' : 'text-fg-muted'}`} />
                <span className="text-[13px] font-semibold text-fg">Generate Video</span>
              </div>
              <p className="text-[11px] text-fg-muted leading-tight">Type a script</p>
            </button>

            {/* Tab 3: Live Conversation */}
            <button
              type="button"
              onClick={() => setActiveTab('live')}
              className={`p-3 rounded-xl text-left border transition-all duration-200 ${
                activeTab === 'live'
                  ? 'bg-accent/15 border-accent/60 shadow-[0_0_20px_rgb(var(--rgb-accent)/0.25)]'
                  : 'bg-fg/[0.03] border-line hover:bg-fg/[0.06] hover:border-line-strong'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Radio className={`size-4 ${activeTab === 'live' ? 'text-accent' : 'text-fg-muted'}`} />
                <span className="text-[13px] font-semibold text-fg">Live Conversation</span>
              </div>
              <p className="text-[11px] text-fg-muted leading-tight">Talk in real time</p>
            </button>

            {/* Tab 4: Build an Agent */}
            <button
              type="button"
              onClick={() => setActiveTab('agent')}
              className={`p-3 rounded-xl text-left border transition-all duration-200 ${
                activeTab === 'agent'
                  ? 'bg-accent/15 border-accent/60 shadow-[0_0_20px_rgb(var(--rgb-accent)/0.25)]'
                  : 'bg-fg/[0.03] border-line hover:bg-fg/[0.06] hover:border-line-strong'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Bot className={`size-4 ${activeTab === 'agent' ? 'text-accent' : 'text-fg-muted'}`} />
                <span className="text-[13px] font-semibold text-fg">Build an Agent</span>
              </div>
              <p className="text-[11px] text-fg-muted leading-tight">Describe your needs</p>
            </button>
          </div>
        </div>
      </div>
    </TiltCard>
  )
}
