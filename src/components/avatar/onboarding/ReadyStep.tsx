import { useNavigate } from 'react-router-dom'
import { Bot, CheckCircle2, Clapperboard, Radio } from 'lucide-react'
import type { Avatar } from '@/types'
import { useWorkspace } from '@/state/workspace'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ExperienceFlow } from '@/components/avatar/ExperienceFlow'
import { StepHeading } from './StepHeading'
import { TrainingStage } from './TrainingStage'

export function ReadyStep({ avatar, focusOnMount }: { avatar: Avatar; focusOnMount?: boolean }) {
  const navigate = useNavigate()
  const { voiceName } = useWorkspace()
  return (
    <section>
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <TrainingStage avatar={avatar} alive className="mx-auto w-full max-w-[340px] sm:max-w-[520px] animate-fade-up">
          <div className="absolute left-5 top-5 sm:left-7 sm:top-7">
            <Badge tone="success" className="bg-black/50 backdrop-blur-md" icon={<CheckCircle2 aria-hidden />}>
              Identity verified
            </Badge>
          </div>
        </TrainingStage>

        <div className="min-w-0">
          <StepHeading
            eyebrow="Step 4 · Ready"
            title={
              <>
                Your avatar
                <br className="hidden sm:block" /> <span className="text-gradient">is ready.</span>
              </>
            }
            description={`${avatar.name} is now a reusable identity. Use the same face and voice everywhere — videos, live conversations and AI agents.`}
            focusOnMount={focusOnMount}
          />

          <dl className="mt-6 grid grid-cols-3 gap-3 rounded-card border border-line bg-white/[0.02] p-4 text-[13px]">
            <div>
              <dt className="text-[11px] text-fg-subtle">Name</dt>
              <dd className="mt-0.5 truncate font-medium">{avatar.name}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-fg-subtle">Voice</dt>
              <dd className="mt-0.5 truncate font-medium">{voiceName(avatar.voiceId)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-fg-subtle">Languages</dt>
              <dd className="mt-0.5 truncate font-medium">{avatar.languages.join(', ')}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="accent" size="lg" leftIcon={<Clapperboard aria-hidden />} onClick={() => navigate(`/create?avatar=${avatar.id}`)}>
              Generate Video
            </Button>
            <Button variant="secondary" size="lg" leftIcon={<Radio aria-hidden />} onClick={() => navigate(`/live?avatar=${avatar.id}`)}>
              Go Live
            </Button>
            <Button variant="secondary" size="lg" leftIcon={<Bot aria-hidden />} onClick={() => navigate(`/agents/new?avatar=${avatar.id}`)}>
              Create Agent
            </Button>
          </div>
          <ButtonLink to={`/avatars/${avatar.id}`} variant="ghost" size="sm" className="mt-3 -ml-3">
            View avatar details
          </ButtonLink>
        </div>
      </div>

      <div className="mt-16">
        <h2 className="text-center text-[19px] font-semibold">One identity, many experiences</h2>
        <p className="mx-auto mt-1.5 max-w-md text-center text-[13px] text-fg-muted">Everything you create with {avatar.name} stays consistent — same face, same voice, same brand.</p>
        <ExperienceFlow avatar={avatar} className="mx-auto mt-8 max-w-4xl" />
      </div>
    </section>
  )
}
