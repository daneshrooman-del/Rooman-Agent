import { useState } from 'react'
import { ArrowRight, Bot, Check, Send, Sparkles, User, Database, Shield, Mic, Briefcase, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { TiltCard } from './TiltCard'

interface ConfigItem {
  label: string
  value: string
  icon: typeof Bot
}

const DEFAULT_CONFIG: ConfigItem[] = [
  { label: 'Agent', value: 'HR Support Agent', icon: Bot },
  { label: 'Knowledge Base', value: 'Job roles, company info, policies', icon: Database },
  { label: 'Objectives', value: 'Answer queries, assist with applications', icon: Briefcase },
  { label: 'Tools', value: 'Calendar, Email, ATS integration', icon: Wrench },
  { label: 'Guardrails', value: 'Professional and safe communication', icon: Shield },
  { label: 'Avatar', value: 'Your digital twin', icon: User },
  { label: 'Voice', value: 'Natural (English)', icon: Mic },
]

export function SectionBuildAgent() {
  const [messages, setMessages] = useState([
    {
      sender: 'user',
      text: 'I need an agent that handles HR enquiries and understands candidate requirements.',
    },
    {
      sender: 'agent',
      text: 'Got it. Who should the agent communicate with?',
    },
    {
      sender: 'user',
      text: 'HR teams and job seekers.',
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [configPulse, setConfigPulse] = useState(false)

  const handleSend = () => {
    if (!inputValue.trim()) return
    const userMsg = inputValue
    setInputValue('')
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }])

    setConfigPulse(true)
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: `Understood! I have updated the tools and knowledge parameters to support: "${userMsg.slice(0, 40)}..."`,
        },
      ])
      setConfigPulse(false)
    }, 900)
  }

  return (
    <section id="agent-section" className="py-24 sm:py-32 relative overflow-hidden bg-white/[0.01]">
      {/* Background glow */}
      <div className="absolute top-1/2 right-10 w-[550px] h-[550px] bg-accent/15 blur-[160px] rounded-full pointer-events-none" />

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-4 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[12px] font-medium text-accent">
              <span className="font-mono text-accent/80">[04]</span>
              <span className="uppercase tracking-wider">Build An Agent</span>
            </div>

            <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white leading-[1.12]">
              From a conversation to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#b3a2ff] via-[#8f7cff] to-[#5b8dff]">
                a working agent.
              </span>
            </h2>

            <p className="text-[16px] sm:text-[17px] text-fg-muted leading-relaxed">
              Describe what you need. The Agent Builder turns it into workflows, knowledge, tools and guardrails — ready to deploy.
            </p>

            <div className="pt-2">
              <Link
                to="/agents/new"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-[14px] font-semibold text-white bg-gradient-to-r from-[#7a63ff] to-[#8f7cff] hover:opacity-95 shadow-[0_0_30px_rgba(122,99,255,0.45)] hover:shadow-[0_0_40px_rgba(122,99,255,0.65)] transition-all duration-300"
              >
                <span>Try agent builder</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          {/* Right Dual-Card Interactive Mockups */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
              {/* Chat Builder Box */}
              <TiltCard maxTilt={5} className="md:col-span-6 h-full">
                <div className="h-full rounded-[24px] bg-[#0c0c14]/90 p-4 border border-white/[0.1] shadow-2xl backdrop-blur-2xl flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="size-6 rounded-lg bg-accent/20 flex items-center justify-center">
                          <Bot className="size-3.5 text-accent" />
                        </div>
                        <span className="text-[13px] font-semibold text-white">Rooman Agent</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[10px] font-mono">
                        Builder Active
                      </span>
                    </div>

                    {/* Messages Container */}
                    <div className="space-y-2.5 max-h-[280px] overflow-y-auto no-scrollbar py-1">
                      {messages.map((m, idx) => (
                        <div
                          key={idx}
                          className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl p-3 text-[12px] leading-relaxed ${
                              m.sender === 'user'
                                ? 'bg-[#232338] text-white border border-white/[0.08] rounded-tr-xs'
                                : 'bg-[#151522] text-fg-muted border border-white/[0.06] rounded-tl-xs'
                            }`}
                          >
                            {m.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Input Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleSend()
                    }}
                    className="pt-3 mt-3 border-t border-white/[0.08]"
                  >
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type your message..."
                        className="w-full bg-white/[0.04] rounded-xl border border-white/[0.08] pl-3 pr-10 py-2.5 text-[12px] text-white placeholder-fg-subtle focus:outline-none focus:border-accent/60"
                      />
                      <button
                        type="submit"
                        className="absolute right-1.5 size-7 rounded-lg bg-accent hover:bg-accent-strong flex items-center justify-center text-white transition-colors"
                        aria-label="Send"
                      >
                        <Send className="size-3.5" />
                      </button>
                    </div>
                  </form>
                </div>
              </TiltCard>

              {/* Generated Agent Configuration Checklist Card */}
              <TiltCard maxTilt={5} className="md:col-span-6 h-full">
                <div
                  className={`h-full rounded-[24px] bg-[#0c0c14]/90 p-4 sm:p-5 border transition-all duration-300 backdrop-blur-2xl shadow-2xl flex flex-col justify-between ${
                    configPulse ? 'border-accent shadow-[0_0_35px_rgba(122,99,255,0.4)]' : 'border-white/[0.1]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
                      <span className="text-[13px] font-semibold text-white">Generated Agent Configuration</span>
                      <Sparkles className="size-3.5 text-accent animate-pulse" />
                    </div>

                    <div className="space-y-3">
                      {DEFAULT_CONFIG.map((item, i) => (
                        <div key={i} className="flex items-start justify-between gap-3 text-[12px]">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-2 text-right">
                            <span className="text-fg-muted truncate max-w-[150px] sm:max-w-[180px]">{item.value}</span>
                            <div className="size-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                              <Check className="size-2.5 stroke-[3]" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-accent">
                    <span>Validation Passed</span>
                    <span className="font-mono text-emerald-400 font-semibold">Ready to Deploy</span>
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
