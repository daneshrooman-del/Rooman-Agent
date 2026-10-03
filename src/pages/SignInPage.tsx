import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Mail, Lock, Sparkles } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function SignInPage() {
  useDocumentTitle('Sign In — Rooman Agent')
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGoogleAuth = async () => {
    setGoogleLoading(true)
    setError('')
    await new Promise((res) => setTimeout(res, 1200))
    setGoogleLoading(false)
    navigate('/workspace')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setLoading(true)
    await new Promise((res) => setTimeout(res, 900))
    setLoading(false)
    navigate('/workspace')
  }

  return (
    <div className="min-h-screen bg-[#05050d] flex flex-col items-center justify-center relative overflow-hidden px-4">
      {/* Star field */}
      <div className="star-field" />

      {/* Ambient orbs */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full"
        style={{ background: 'radial-gradient(ellipse, rgba(155,135,255,0.18) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full"
        style={{ background: 'radial-gradient(ellipse, rgba(79,163,255,0.12) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      <div className="pointer-events-none absolute top-1/4 left-0 w-[350px] h-[350px] rounded-full"
        style={{ background: 'radial-gradient(ellipse, rgba(45,212,212,0.07) 0%, transparent 70%)', filter: 'blur(70px)' }} />

      {/* Grid lines */}
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-[0.4]" />

      <div className="relative z-10 w-full max-w-[440px] animate-fade-up">
        {/* Back to home */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="size-9 rounded-xl flex items-center justify-center shadow-[0_0_24px_rgba(155,135,255,0.6)]"
              style={{ background: 'linear-gradient(135deg, #9b87ff, #4fa3ff)' }}>
              <Sparkles className="size-4 text-white" />
            </div>
            <span className="text-[15px] font-bold text-white tracking-tight">Rooman Agent</span>
          </Link>
          <Link to="/" className="text-[13px] text-[#9898b8] hover:text-white transition-colors">
            ← Back
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-[28px] p-8 shadow-[0_32px_100px_rgba(0,0,0,0.7),0_0_0_1px_rgba(155,135,255,0.15)]"
          style={{ background: 'linear-gradient(145deg, rgba(22,22,40,0.95), rgba(11,11,22,0.98))', backdropFilter: 'blur(32px)' }}>

          {/* Top accent line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/4 rounded-full"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(155,135,255,0.6), rgba(79,163,255,0.6), transparent)' }} />

          <div className="mb-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#9b87ff]/10 border border-[#9b87ff]/20 text-[12px] font-medium text-[#9b87ff] mb-3">
              <span className="uppercase tracking-wider">Welcome back</span>
            </div>
            <h1 className="font-display text-[30px] font-bold text-white tracking-tight mb-2">
              Sign in to your account
            </h1>
            <p className="text-[14px] text-[#9898b8]">
              Access your avatars, videos and agents.
            </p>
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            id="signin-google"
            onClick={handleGoogleAuth}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-[16px] text-[14px] font-semibold text-white transition-all duration-200 mb-5 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
            onMouseEnter={e => { if (!googleLoading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.11)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)' }}
          >
            {googleLoading ? (
              <>
                <svg className="animate-spin size-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
                  <path d="M47.5 24.5c0-1.6-.14-3.2-.41-4.7H24v9h13.1c-.57 3.1-2.26 5.7-4.8 7.4v6.1h7.8c4.56-4.2 7.4-10.4 7.4-17.8z" fill="#4285F4"/>
                  <path d="M24 48c6.5 0 11.96-2.15 15.94-5.8l-7.8-6.1c-2.15 1.44-4.9 2.3-8.14 2.3-6.27 0-11.58-4.23-13.48-9.93H2.52v6.28C6.5 42.67 14.67 48 24 48z" fill="#34A853"/>
                  <path d="M10.52 28.47A14.9 14.9 0 0 1 9.5 24c0-1.57.27-3.1.75-4.53v-6.28H2.52A23.97 23.97 0 0 0 0 24c0 3.87.93 7.53 2.52 10.75l8-6.28z" fill="#FBBC05"/>
                  <path d="M24 9.57c3.53 0 6.7 1.21 9.19 3.6l6.88-6.88C35.95 2.39 30.5 0 24 0 14.67 0 6.5 5.33 2.52 13.2l8 6.28C12.42 13.8 17.73 9.57 24 9.57z" fill="#EA4335"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <span className="text-[12px] text-[#65658a]">or continue with email</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="signin-email" className="text-[13px] font-medium text-[#9898b8]">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#65658a] pointer-events-none" />
                <input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3.5 rounded-[14px] text-[14px] text-white placeholder:text-[#65658a] focus:outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
                  onFocus={e => { e.currentTarget.style.border = '1px solid rgba(155,135,255,0.5)'; e.currentTarget.style.background = 'rgba(155,135,255,0.06)' }}
                  onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.09)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="signin-password" className="text-[13px] font-medium text-[#9898b8]">Password</label>
                <a href="#" className="text-[12px] text-[#9b87ff] hover:text-white transition-colors">Forgot?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#65658a] pointer-events-none" />
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3.5 rounded-[14px] text-[14px] text-white placeholder:text-[#65658a] focus:outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
                  onFocus={e => { e.currentTarget.style.border = '1px solid rgba(155,135,255,0.5)'; e.currentTarget.style.background = 'rgba(155,135,255,0.06)' }}
                  onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.09)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#65658a] hover:text-[#9898b8] transition-colors"
                  aria-label="Toggle password"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-[13px] text-red-400">{error}</p>}

            <button
              id="signin-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-[16px] text-[15px] font-bold text-white transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{ background: 'linear-gradient(135deg, #7c63ff, #9b87ff, #4fa3ff)', boxShadow: '0 0 36px rgba(155,135,255,0.5), 0 4px 20px rgba(0,0,0,0.4)' }}
            >
              {loading ? (
                <svg className="animate-spin size-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-[13px] text-[#9898b8]">
            No account?{' '}
            <Link to="/signup" className="text-[#9b87ff] hover:text-white font-semibold transition-colors">
              Create one free →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
