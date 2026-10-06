/* ------------------------------------------------------------------
   Auth — account registry + session.

   There is no auth backend yet, so accounts live in this browser's
   localStorage. Passwords are salted + SHA-256 hashed, sign-in only
   succeeds for an email that was registered on /signup, and the app
   routes are guarded by <RequireAuth>. Swap these functions for real
   API calls once the backend exposes /auth endpoints.

   Google sign-in uses Google Identity Services and is only enabled
   when VITE_GOOGLE_CLIENT_ID is set.
   ------------------------------------------------------------------ */
import { useSyncExternalStore } from 'react'

export type AuthProvider = 'password' | 'google'

interface Account {
  name: string
  email: string
  provider: AuthProvider
  salt?: string
  passwordHash?: string
  picture?: string
  createdAt: string
}

export interface Session {
  name: string
  email: string
  provider: AuthProvider
  picture?: string
}

const ACCOUNTS_KEY = 'rooman.auth.accounts'
const SESSION_KEY = 'rooman.auth.session'

export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || ''
export const isGoogleEnabled = GOOGLE_CLIENT_ID.length > 0

export class AuthError extends Error {}

/* ---------- storage ---------- */

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    throw new AuthError('Your browser blocked local storage, so we could not save your account.')
  }
}

const loadAccounts = () => read<Record<string, Account>>(ACCOUNTS_KEY, {})
const normalize = (email: string) => email.trim().toLowerCase()

/* ---------- session store (subscribable) ---------- */

const listeners = new Set<() => void>()
let cachedSession: Session | null = read<Session | null>(SESSION_KEY, null)

function setSession(session: Session | null) {
  write(SESSION_KEY, session)
  cachedSession = session
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key !== SESSION_KEY) return
    cachedSession = read<Session | null>(SESSION_KEY, null)
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export const getSession = () => cachedSession

export function useSession() {
  return useSyncExternalStore(subscribe, getSession, getSession)
}

/* ---------- password hashing ---------- */

async function hashPassword(password: string, salt: string) {
  if (!crypto?.subtle) throw new AuthError('Secure sign-in needs HTTPS or localhost.')
  const bytes = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

const newSalt = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')

/* ---------- email + password ---------- */

export async function signUp(input: { name: string; email: string; password: string }) {
  const email = normalize(input.email)
  const accounts = loadAccounts()
  if (accounts[email]) {
    throw new AuthError('An account with this email already exists. Sign in instead.')
  }
  const salt = newSalt()
  const account: Account = {
    name: input.name.trim(),
    email,
    provider: 'password',
    salt,
    passwordHash: await hashPassword(input.password, salt),
    createdAt: new Date().toISOString(),
  }
  write(ACCOUNTS_KEY, { ...accounts, [email]: account })
  setSession({ name: account.name, email, provider: 'password' })
}

export async function signIn(input: { email: string; password: string }) {
  const email = normalize(input.email)
  const account = loadAccounts()[email]
  if (!account) {
    throw new AuthError('No account found for this email. Create an account first.')
  }
  if (account.provider === 'google' || !account.salt || !account.passwordHash) {
    throw new AuthError('This account uses Google sign-in. Use "Continue with Google".')
  }
  if ((await hashPassword(input.password, account.salt)) !== account.passwordHash) {
    throw new AuthError('Incorrect password. Please try again.')
  }
  setSession({ name: account.name, email, provider: 'password' })
}

export function signOut() {
  setSession(null)
}

/* ---------- Google ---------- */

interface GoogleProfile {
  email: string
  name: string
  picture?: string
  email_verified?: boolean
}

/** Decode the payload of the ID token Google Identity Services returns. */
function decodeGoogleCredential(credential: string): GoogleProfile {
  try {
    const part = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      Array.from(atob(part), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    )
    return JSON.parse(json) as GoogleProfile
  } catch {
    throw new AuthError('Google returned an invalid response. Please try again.')
  }
}

/**
 * mode 'signup' creates the account if needed; mode 'signin' requires the
 * Google account to have been registered first.
 */
export function authenticateWithGoogle(credential: string, mode: 'signin' | 'signup') {
  const profile = decodeGoogleCredential(credential)
  if (!profile.email || profile.email_verified === false) {
    throw new AuthError('Your Google account email is not verified.')
  }
  const email = normalize(profile.email)
  const accounts = loadAccounts()
  const existing = accounts[email]

  if (!existing) {
    if (mode === 'signin') {
      throw new AuthError(`No account found for ${email}. Create an account first.`)
    }
    const account: Account = {
      name: profile.name || email.split('@')[0],
      email,
      provider: 'google',
      picture: profile.picture,
      createdAt: new Date().toISOString(),
    }
    write(ACCOUNTS_KEY, { ...accounts, [email]: account })
  } else if (mode === 'signup') {
    throw new AuthError('An account with this email already exists. Sign in instead.')
  }

  const account = loadAccounts()[email]
  setSession({ name: account.name, email, provider: 'google', picture: profile.picture ?? account.picture })
}
