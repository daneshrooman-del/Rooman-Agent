import { useState } from 'react'
import { X, CheckCircle2, Send, Building, Mail, User, Sparkles } from 'lucide-react'

interface ContactModalProps {
  open: boolean
  onClose: () => void
}

export function ContactModal({ open, onClose }: ContactModalProps) {
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    teamSize: '10-50',
    useCase: 'enterprise-agent',
  })

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => {
      // auto close after confirmation
      setTimeout(() => {
        setSubmitted(false)
        onClose()
      }, 1800)
    }, 400)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-lg rounded-[28px] bg-[#0d0d16] border border-white/[0.12] p-6 sm:p-8 shadow-[0_0_80px_rgba(122,99,255,0.3)] backdrop-blur-2xl"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 size-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-fg-muted hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        {submitted ? (
          <div className="py-10 text-center space-y-3">
            <div className="size-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="size-8" />
            </div>
            <h3 className="text-xl font-bold text-white">Thank you!</h3>
            <p className="text-[14px] text-fg-muted max-w-xs mx-auto">
              Our enterprise solutions team will reach out to you within 2 business hours.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent/15 text-accent text-[11px] font-medium">
                <Sparkles className="size-3" />
                <span>Enterprise Custom Twin & AI Agents</span>
              </div>
              <h3 className="text-2xl font-bold text-white">Talk to our AI specialist</h3>
              <p className="text-[13px] text-fg-muted">
                Custom avatar training, dedicated WebRTC infrastructure, and custom integrations.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-[12px] font-medium text-fg-muted mb-1">Your Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-fg-subtle" />
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Jane Doe"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] text-white focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-fg-muted mb-1">Work Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-fg-subtle" />
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jane@company.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] text-white focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-fg-muted mb-1">Company</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-fg-subtle" />
                    <input
                      required
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      placeholder="Acme Inc."
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-fg-muted mb-1">Team Size</label>
                  <select
                    value={formData.teamSize}
                    onChange={(e) => setFormData({ ...formData, teamSize: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#141420] border border-white/[0.08] text-[13px] text-white focus:outline-none focus:border-accent"
                  >
                    <option value="1-10">1-10 people</option>
                    <option value="10-50">10-50 people</option>
                    <option value="50-250">50-250 people</option>
                    <option value="250+">250+ enterprise</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl text-[14px] font-semibold text-white bg-gradient-to-r from-[#7a63ff] to-[#8f7cff] hover:opacity-95 shadow-[0_0_25px_rgba(122,99,255,0.4)] flex items-center justify-center gap-2 transition-all"
              >
                <span>Request Enterprise Consultation</span>
                <Send className="size-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
