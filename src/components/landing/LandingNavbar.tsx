import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Menu, X, ArrowRight, Video, Radio, Cpu } from 'lucide-react'

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#05050d]/88 backdrop-blur-xl border-b border-white/[0.07] shadow-[0_10px_40px_rgba(0,0,0,0.7)] py-3.5'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Left Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {/* Products Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setActiveDropdown('products')}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <button
              type="button"
              className="px-3.5 py-2 text-[14px] font-medium text-fg-muted hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors flex items-center gap-1"
            >
              Products
              <ChevronDown className={`size-3.5 transition-transform duration-200 ${activeDropdown === 'products' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'products' && (
              <div className="absolute top-full left-0 w-72 pt-2 animate-fade-in">
                <div className="p-2 rounded-2xl bg-[#0f0f16]/95 border border-white/[0.09] shadow-2xl backdrop-blur-2xl space-y-1">
                  <a
                    href="#avatar-section"
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/[0.06] transition-colors group"
                  >
              <div className="p-2 rounded-lg bg-[#9b87ff]/12 text-[#9b87ff]">
                      <Cpu className="size-4" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-white group-hover:text-accent transition-colors">AI Digital Twins</div>
                      <div className="text-[12px] text-fg-muted">Photorealistic avatar creation</div>
                    </div>
                  </a>
                  <a
                    href="#video-section"
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/[0.06] transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                      <Video className="size-4" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-white group-hover:text-blue-400 transition-colors">Video Generation</div>
                      <div className="text-[12px] text-fg-muted">Script to finished video studio</div>
                    </div>
                  </a>
                  <a
                    href="#live-section"
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/[0.06] transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Radio className="size-4" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-white group-hover:text-emerald-400 transition-colors">Live Conversations</div>
                      <div className="text-[12px] text-fg-muted">Real-time WebRTC 2-way dialogue</div>
                    </div>
                  </a>
                  <a
                    href="#agent-section"
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/[0.06] transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                      <Cpu className="size-4" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-white group-hover:text-purple-400 transition-colors">Autonomous Agents</div>
                      <div className="text-[12px] text-fg-muted">Conversational agent builder & workflows</div>
                    </div>
                  </a>
                </div>
              </div>
            )}
          </div>

          <a
            href="#agent-section"
            className="px-3.5 py-2 text-[14px] font-medium text-fg-muted hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            Use Cases
          </a>

          <a
            href="#video-section"
            className="px-3.5 py-2 text-[14px] font-medium text-fg-muted hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            Developers
          </a>

          <a
            href="#faq-section"
            className="px-3.5 py-2 text-[14px] font-medium text-fg-muted hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            Resources
          </a>
        </nav>

        {/* Right CTA Actions */}
        <div className="flex items-center gap-3">
          <Link
            to="/signin"
            className="px-4 py-2 rounded-xl text-[13px] sm:text-[14px] font-medium text-fg-muted hover:text-white hover:bg-white/[0.06] border border-white/[0.08] transition-all duration-200"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="relative group inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl text-[13px] sm:text-[14px] font-bold text-white transition-all duration-300"
            style={{ background: 'linear-gradient(135deg, #7c63ff, #9b87ff, #4fa3ff)', boxShadow: '0 0 24px rgba(155,135,255,0.45)' }}
          >
            <span>Get started</span>
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-fg-muted hover:text-white hover:bg-white/[0.06]"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/[0.08] bg-[#0c0c12]/95 backdrop-blur-2xl px-4 py-6 space-y-3 animate-fade-in">
          <a
            href="#avatar-section"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-[15px] font-medium text-fg hover:text-white rounded-lg hover:bg-white/[0.05]"
          >
            Avatars & Digital Identity
          </a>
          <a
            href="#video-section"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-[15px] font-medium text-fg hover:text-white rounded-lg hover:bg-white/[0.05]"
          >
            Video Generation
          </a>
          <a
            href="#live-section"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-[15px] font-medium text-fg hover:text-white rounded-lg hover:bg-white/[0.05]"
          >
            Live Conversation
          </a>
          <a
            href="#agent-section"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-[15px] font-medium text-fg hover:text-white rounded-lg hover:bg-white/[0.05]"
          >
            Agent Builder
          </a>
          <a
            href="#faq-section"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-[15px] font-medium text-fg hover:text-white rounded-lg hover:bg-white/[0.05]"
          >
            FAQ
          </a>
          <div className="pt-3 border-t border-white/[0.08] space-y-2">
            <Link
              to="/signin"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full block text-center py-2.5 rounded-xl text-[14px] font-medium text-fg-muted border border-white/[0.08] hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full block text-center py-2.5 rounded-xl text-[14px] font-semibold text-white bg-gradient-to-r from-[#7a63ff] to-[#5b8dff]"
            >
              Get started free
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
