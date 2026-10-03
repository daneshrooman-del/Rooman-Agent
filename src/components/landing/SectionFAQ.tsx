import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { FAQTabs } from '@/components/ui/faq-tabs'

export function SectionFAQ() {
  return (
    <section id="faq-section" className="py-24 sm:py-32 relative overflow-hidden bg-white/[0.01]">
      {/* Subtle ambient glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#8f7cff]/[0.05] blur-[140px] rounded-full" />

      <div className="max-w-[980px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <FAQTabs />

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.1] hover:border-accent/30 transition-all duration-200"
          >
            <span>Still have questions? Contact us</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
