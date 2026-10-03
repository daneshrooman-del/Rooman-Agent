import { Link } from 'react-router-dom'
import { Bot, Sparkles } from 'lucide-react'

export function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#07070c] pt-16 pb-12 relative overflow-hidden text-[13px]">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12 mb-16">
          {/* Brand Info */}
          <div className="col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-gradient-to-tr from-[#7c5eff] to-[#5b8dff] p-[1px]">
                <div className="w-full h-full bg-[#0e0e14] rounded-[11px] flex items-center justify-center">
                  <Bot className="size-4 text-[#a78bfa]" />
                </div>
              </div>
              <span className="font-display text-[18px] font-bold tracking-tight text-white">
                Rooman <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#a78bfa] to-[#818cf8]">Agent</span>
              </span>
            </Link>

            <p className="text-fg-muted max-w-sm leading-relaxed text-[13px]">
              Next-generation AI avatar engine. One digital identity powering video generation, live WebRTC conversations, and autonomous workforce agents.
            </p>
          </div>

          {/* Column 1: PRODUCT */}
          <div>
            <h4 className="font-semibold text-white tracking-wider uppercase text-[11px] mb-4">Product</h4>
            <ul className="space-y-2.5">
              <li>
                <a href="#avatar-section" className="text-fg-muted hover:text-white transition-colors">
                  Avatars
                </a>
              </li>
              <li>
                <a href="#video-section" className="text-fg-muted hover:text-white transition-colors">
                  Video generation
                </a>
              </li>
              <li>
                <a href="#live-section" className="text-fg-muted hover:text-white transition-colors">
                  Live conversations
                </a>
              </li>
              <li>
                <a href="#agent-section" className="text-fg-muted hover:text-white transition-colors">
                  Agent builder
                </a>
              </li>
              <li>
                <Link to="/workspace" className="text-accent hover:underline flex items-center gap-1">
                  <span>Open Studio</span>
                  <Sparkles className="size-3" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: COMPANY */}
          <div>
            <h4 className="font-semibold text-white tracking-wider uppercase text-[11px] mb-4">Company</h4>
            <ul className="space-y-2.5">
              <li>
                <a href="#" className="text-fg-muted hover:text-white transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="#" className="text-fg-muted hover:text-white transition-colors">
                  Careers
                </a>
              </li>
              <li>
                <a href="#" className="text-fg-muted hover:text-white transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="text-fg-muted hover:text-white transition-colors">
                  Press Kit
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: RESOURCES */}
          <div>
            <h4 className="font-semibold text-white tracking-wider uppercase text-[11px] mb-4">Resources</h4>
            <ul className="space-y-2.5">
              <li>
                <a href="#faq-section" className="text-fg-muted hover:text-white transition-colors">
                  Help center
                </a>
              </li>
              <li>
                <a href="#faq-section" className="text-fg-muted hover:text-white transition-colors">
                  FAQ
                </a>
              </li>
              <li>
                <a href="#trust-section" className="text-fg-muted hover:text-white transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#trust-section" className="text-fg-muted hover:text-white transition-colors">
                  Security
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright & legal */}
        <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-fg-subtle">
          <div>© 2026 Rooman Agent. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-fg-muted transition-colors">
              Privacy policy
            </a>
            <a href="#" className="hover:text-fg-muted transition-colors">
              Terms of service
            </a>
            <a href="#" className="hover:text-fg-muted transition-colors">
              Consent standards
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
