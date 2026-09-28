import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Lock, Sparkles } from 'lucide-react'
import type { Avatar } from '@/types'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { Button } from '@/components/ui/Button'
import { StepIndicator } from '@/components/avatar/onboarding/StepIndicator'
import { UploadStep } from '@/components/avatar/onboarding/UploadStep'
import { ConsentStep, consentComplete, emptyConsent, type ConsentState } from '@/components/avatar/onboarding/ConsentStep'
import { ProcessingStep } from '@/components/avatar/onboarding/ProcessingStep'
import { ReadyStep } from '@/components/avatar/onboarding/ReadyStep'
import type { ReferenceSource } from '@/components/avatar/onboarding/ReferencePreview'

const STEPS = ['Upload', 'Consent', 'Processing', 'Ready']
const TITLES = ['Create avatar', 'Consent', 'Creating avatar', 'Avatar ready']

export default function AvatarCreatePage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [navigated, setNavigated] = useState(false)
  const [source, setSource] = useState<ReferenceSource | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [name, setName] = useState('My Digital Twin')
  const [consent, setConsent] = useState<ConsentState>(emptyConsent)
  const [created, setCreated] = useState<Avatar | null>(null)
  useDocumentTitle(TITLES[step])

  const go = (n: number) => {
    setNavigated(true)
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onTrained = useCallback((a: Avatar) => {
    setCreated(a)
    setNavigated(true)
    setStep(3)
  }, [])

  const canContinue = step === 0 ? !!source && name.trim().length > 0 : step === 1 ? consentComplete(consent) : false

  const back = () => {
    if (step === 1) go(0)
    else navigate('/avatars')
  }

  return (
    <div className="relative">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeft aria-hidden />} onClick={back} className="-ml-2 self-start sm:self-auto">
          {step === 1 ? 'Back' : 'My Avatars'}
        </Button>
        <div className="flex-1">
          <StepIndicator steps={STEPS} current={step} />
        </div>
      </div>

      <div className="mt-10 sm:mt-12" key={step}>
        {step === 0 && (
          <UploadStep source={source} onSource={setSource} name={name} onName={setName} error={uploadError} onError={setUploadError} focusOnMount={navigated} />
        )}
        {step === 1 && <ConsentStep value={consent} onChange={setConsent} avatarName={name.trim()} focusOnMount={navigated} />}
        {step === 2 && source && <ProcessingStep name={name} source={source} onDone={onTrained} focusOnMount={navigated} />}
        {step === 3 && created && <ReadyStep avatar={created} focusOnMount={navigated} />}
      </div>

      {step < 2 && (
        <div className="mt-10 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-[12px] text-fg-subtle">
            <Lock className="size-3.5" aria-hidden />
            {step === 0
              ? source
                ? 'Your footage is private to your workspace.'
                : 'Upload a video or use sample footage to continue.'
              : canContinue
                ? 'Consent is stored with the avatar and can be revoked anytime.'
                : 'Confirm all three statements and sign to continue.'}
          </p>
          <div className="flex gap-2">
            {step === 1 && (
              <Button variant="ghost" onClick={() => go(0)} className="flex-1 sm:flex-none">
                Back
              </Button>
            )}
            {step === 0 ? (
              <Button variant="primary" size="lg" rightIcon={<ArrowRight aria-hidden />} disabled={!canContinue} onClick={() => go(1)} className="flex-1 sm:flex-none">
                Continue
              </Button>
            ) : (
              <Button variant="accent" size="lg" leftIcon={<Sparkles aria-hidden />} disabled={!canContinue} onClick={() => go(2)} className="flex-1 sm:flex-none">
                Agree and start training
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
