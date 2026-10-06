import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Mail, Lock, User } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { AuthError, authenticateWithGoogle, signUp, useSession } from '@/lib/auth'
import { GoogleButton } from '@/components/auth/GoogleButton'
import { AuthLogo, AuthPanel } from '@/components/auth/AuthBackdrop'

export default function SignUpPage() {
  useDocumentTitle('Create Account — Rooman Agent')
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const session = useSession()

  const handleGoogleCredential = (credential: string) => {
    setError('')
    try {
      authenticateWithGoogle(credential, 'signup')
      navigate('/workspace', { replace: true })
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Google sign-up failed. Please try again.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name || !email || !password) { setError('Please fill in all fields.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email address.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      await signUp({ name, email, password })
      navigate('/workspace', { replace: true })
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Could not create your account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const strengthScore = Math.min(4, Math.floor(password.length / 3))
  const strengthColors = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400', 'bg-emerald-500']
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong']

  const inputStyle: React.CSSProperties = { background: 'rgb(var(--rgb-fg) / 0.04)', border: '1px solid var(--color-line-strong)' }
  const inputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = '1px solid rgb(var(--rgb-accent) / 0.5)'
    e.currentTarget.style.background = 'rgb(var(--rgb-accent) / 0.06)'
  }
  const inputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = '1px solid var(--color-line-strong)'
    e.currentTarget.style.background = 'rgb(var(--rgb-fg) / 0.04)'
  }

  if (session && !loading) return <Navigate to="/workspace" replace />

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-2">
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">

      <div className="relative z-10 w-full max-w-[440px] animate-fade-up">
        {/* Back to home */}
        <div className="flex items-center justify-between mb-8">
          <AuthLogo />
          <div className="flex items-center gap-2">
            <Link to="/" className="rounded-full bg-surface/90 px-3 py-1.5 text-[13px] font-medium text-fg-muted shadow-sm ring-1 ring-line hover:text-fg transition-colors">
              ← Back
            </Link>
          </div>
        </div>

        {/* Card */}
        <div className="relative rounded-[28px] p-8 shadow-[0_32px_100px_rgb(var(--rgb-shadow)/0.4),0_0_0_1px_rgb(var(--rgb-accent)/0.15)]"
          style={{ background: 'linear-gradient(145deg, var(--color-surface-2), var(--color-surface))', backdropFilter: 'blur(32px)' }}>

          {/* Top accent line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/4 rounded-full"
            style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--rgb-accent) / 0.6), rgb(var(--rgb-sky) / 0.6), transparent)' }} />

          <div className="mb-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-3/10 border border-accent-3/20 text-[12px] font-medium text-accent-3 mb-3">
              <span className="uppercase tracking-wider">Free to start</span>
            </div>
            <h1 className="font-display text-[30px] font-bold text-fg tracking-tight mb-2">
              Create your account
            </h1>
            <p className="text-[14px] text-fg-muted">
              Build AI avatars, videos and agents — no credit card needed.
            </p>
          </div>

          <GoogleButton mode="signup" onCredential={handleGoogleCredential} onError={setError} />

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label htmlFor="signup-name" className="text-[13px] font-medium text-fg-muted">Full name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-fg-subtle pointer-events-none" />
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full pl-10 pr-4 py-3.5 rounded-[14px] text-[14px] text-fg placeholder:text-fg-subtle focus:outline-none transition-all"
                  style={inputStyle}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="signup-email" className="text-[13px] font-medium text-fg-muted">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-fg-subtle pointer-events-none" />
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3.5 rounded-[14px] text-[14px] text-fg placeholder:text-fg-subtle focus:outline-none transition-all"
                  style={inputStyle}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="signup-password" className="text-[13px] font-medium text-fg-muted">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-fg-subtle pointer-events-none" />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full pl-10 pr-10 py-3.5 rounded-[14px] text-[14px] text-fg placeholder:text-fg-subtle focus:outline-none transition-all"
                  style={inputStyle}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg-muted transition-colors"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {/* Password strength */}
              {password.length > 0 && (
                <div className="space-y-1 pt-0.5">
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-400 ${
                          i < strengthScore ? strengthColors[strengthScore] : 'bg-fg/[0.08]'
                        }`}
                      />
                    ))}
                  </div>
                  {strengthScore > 0 && (
                    <p className="text-[11px] text-fg-subtle">
                      Strength: <span className="font-medium text-fg-muted">{strengthLabels[strengthScore]}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {error && <p className="text-[13px] text-danger">{error}</p>}

            <p className="text-[12px] text-fg-subtle leading-relaxed pt-1">
              By creating an account you agree to our{' '}
              <a href="#" className="text-accent hover:text-fg transition-colors">Terms</a>
              {' '}and{' '}
              <a href="#" className="text-accent hover:text-fg transition-colors">Privacy Policy</a>.
            </p>

            <button
              id="signup-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-[16px] text-[15px] font-bold text-white transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed mt-1"
              style={{ background: 'var(--grad-accent)', boxShadow: '0 0 36px rgb(var(--rgb-accent) / 0.45), 0 4px 20px rgb(var(--rgb-shadow) / 0.3)' }}
            >
              {loading ? (
                <svg className="animate-spin size-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <>
                  <span>Create free account</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-[13px] text-fg-muted">
            Already have an account?{' '}
            <Link to="/signin" className="text-accent hover:text-fg font-semibold transition-colors">
              Sign in →
            </Link>
          </p>
        </div>
      </div>
      </div>
      <AuthPanel />
    </div>
  )
}
