import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/cn'

/* ── Types ─────────────────────────────────────────────────── */
interface FAQItem {
  question: string
  answer: string
}

type FAQData = Record<string, FAQItem[]>
type Categories = Record<string, string>

interface FAQTabsProps {
  title?: string
  subtitle?: string
  className?: string
  categories?: Categories
  faqData?: FAQData
}

/* ── Default Data ───────────────────────────────────────────── */
const DEFAULT_CATEGORIES: Categories = {
  avatars: 'Avatars',
  video: 'Video',
  agents: 'Agents',
  privacy: 'Account & Privacy',
}

const DEFAULT_FAQ_DATA: FAQData = {
  avatars: [
    {
      question: 'How do I create an avatar?',
      answer:
        'Record a short 2-minute video directly in your browser or upload existing high-resolution footage. Follow the on-screen vocal consent prompt to verify your identity. Our neural training pipeline takes under 10 minutes to deliver your reusable digital twin.',
    },
    {
      question: 'Can I use my own voice?',
      answer:
        'Yes! Rooman Agent automatically extracts your vocal acoustics, cadence, and tone during the reference upload. You can generate speech in your exact voice or translate your avatar into 30+ languages while preserving your voice timbre.',
    },
    {
      question: 'How realistic is my avatar?',
      answer:
        'Our proprietary NeRF-based rendering engine produces studio-quality photorealistic avatars. Subtle eye movements, micro-expressions, and natural head motions are all synthesized to match your reference footage — indistinguishable from a real recording in most use cases.',
    },
  ],
  video: [
    {
      question: 'What video resolutions and formats are supported?',
      answer:
        'Videos can be exported in 1080p Full HD and 4K Ultra HD in standard MP4/H.264 and ProRes formats. You can choose 16:9 for presentations and web, 9:16 for mobile/TikTok, and 1:1 for social feeds.',
    },
    {
      question: 'How long does video generation take?',
      answer:
        'Most videos under 3 minutes render in under 60 seconds. Longer videos or 4K exports may take 2–5 minutes. We use a distributed GPU cluster to keep wait times minimal even during peak load.',
    },
    {
      question: 'Can I add custom backgrounds and branding?',
      answer:
        'Absolutely. You can upload your own branded background, choose from our library of 200+ studio scenes, or use our AI background generator. Logos, lower thirds, and branded intros/outros are all supported.',
    },
  ],
  agents: [
    {
      question: 'What actions can my avatar agent perform?',
      answer:
        'Beyond pre-recorded videos, your avatar can conduct live two-way WebRTC video calls, execute tool actions (calendaring, ticket creation, email dispatches), and query company knowledge bases with citation grounding.',
    },
    {
      question: 'How does the conversational Agent Builder work?',
      answer:
        'Simply chat with our builder agent. State your goals, required integrations (Slack, HubSpot, Google Workspace), and knowledge files. The builder automatically synthesizes an autonomous agent workflow with safety guardrails.',
    },
    {
      question: 'Can agents be embedded on external websites?',
      answer:
        'Yes. Every agent gets a shareable link and an embeddable JavaScript widget. You can drop it into any website, Notion page, or help center in under a minute, with full CORS and CSP compliance.',
    },
  ],
  privacy: [
    {
      question: 'How is my biometric and voice data protected?',
      answer:
        'All voice prints, face geometry, and raw videos are encrypted with AES-256 at rest and TLS 1.3 in transit. We enforce strict tenant isolation, and your data is never used to train foundation models without explicit consent. You can purge all avatar artifacts at any time.',
    },
    {
      question: 'Who can use my avatar?',
      answer:
        'Only you — and team members you explicitly grant access to. Every avatar action is governed by a consent token. Third parties cannot access or clone your likeness without your signed authorization.',
    },
    {
      question: 'Is Rooman Agent GDPR and CCPA compliant?',
      answer:
        'Yes. We are fully compliant with GDPR, CCPA, and SOC 2 Type II. Data processing agreements are available for enterprise customers, and our privacy-by-design architecture ensures minimal data retention by default.',
    },
  ],
}

/* ── Component ──────────────────────────────────────────────── */
export function FAQTabs({
  title = 'Frequently asked questions',
  subtitle = 'Everything you need to know about Rooman Agent.',
  className,
  categories = DEFAULT_CATEGORIES,
  faqData = DEFAULT_FAQ_DATA,
}: FAQTabsProps) {
  const categoryKeys = Object.keys(categories)
  const [activeTab, setActiveTab] = useState(categoryKeys[0])
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const items = faqData[activeTab] ?? []

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    setOpenIndex(0)
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Header */}
      <div className="text-center space-y-4 mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[12px] font-medium text-accent">
          <span className="uppercase tracking-wider">FAQ</span>
        </div>
        <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[16px] text-fg-muted max-w-xl mx-auto">{subtitle}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="relative flex flex-wrap items-center justify-center gap-2 mb-10">
        {categoryKeys.map((key) => {
          const isActive = activeTab === key
          return (
            <button
              key={key}
              type="button"
              id={`faq-tab-${key}`}
              onClick={() => handleTabChange(key)}
              className={cn(
                'relative px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-300',
                isActive
                  ? 'text-white'
                  : 'bg-white/[0.04] border border-white/[0.07] text-fg-muted hover:text-white hover:bg-white/[0.08]'
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="faq-pill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#7a63ff] to-[#5b8dff] shadow-[0_0_20px_rgba(143,124,255,0.45)]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{categories[key]}</span>
            </button>
          )
        })}
      </div>

      {/* Accordion */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-3"
        >
          {items.map((item, index) => {
            const isOpen = openIndex === index
            return (
              <div
                key={index}
                className={cn(
                  'rounded-[18px] border overflow-hidden transition-all duration-300',
                  isOpen
                    ? 'bg-[#0f0f1a] border-accent/30 shadow-[0_0_24px_rgba(143,124,255,0.1)]'
                    : 'bg-[#0d0d16]/90 border-white/[0.08] hover:border-white/[0.14]'
                )}
              >
                <button
                  type="button"
                  id={`faq-item-${activeTab}-${index}`}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-5 sm:p-6 text-left transition-colors group"
                >
                  <span className={cn(
                    'text-[15px] font-semibold pr-4 transition-colors',
                    isOpen ? 'text-white' : 'text-fg group-hover:text-white'
                  )}>
                    {item.question}
                  </span>
                  <div className={cn(
                    'size-7 rounded-lg border flex items-center justify-center shrink-0 transition-all duration-300',
                    isOpen
                      ? 'bg-accent/15 border-accent/30 rotate-0'
                      : 'bg-white/[0.05] border-white/[0.08]'
                  )}>
                    {isOpen
                      ? <Minus className="size-4 text-accent" />
                      : <Plus className="size-4 text-fg-muted group-hover:text-white" />
                    }
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-1 border-t border-white/[0.04]">
                        <p className="text-[14px] text-fg-muted leading-relaxed">
                          {item.answer}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
