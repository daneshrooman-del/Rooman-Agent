import { StudioHero, ScrollStory, UseCases, Faq } from '@/components/landing/studio/Sections'
import { FeatureExplorer } from '@/components/landing/studio/FeatureExplorer'
import { StudioLayout } from '@/components/landing/studio/Layout'

/* Landing page: "Bone and cobalt" on white, with a WebGL hero, a scroll-driven 3D prism and a
   3D coverflow. Each section also has its own page (pages/landing/InfoPages.tsx). */
export default function LandingPage() {
  return (
    <StudioLayout title="Rooman Agent — AI Avatars & Agents">
      <StudioHero />
      <ScrollStory />
      <FeatureExplorer />
      <UseCases />
      <Faq />
    </StudioLayout>
  )
}
