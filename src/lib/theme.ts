import { useSyncExternalStore } from 'react'

/**
 * Light / dark theme. The active theme lives on <html data-theme="…">.
 * index.html sets it before first paint (stored choice, else light)
 * so there is no flash; this module keeps it in sync afterwards.
 */
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const META_COLOR: Record<Theme, string> = { light: '#FFFFFF', dark: '#0C1433' }
const listeners = new Set<() => void>()

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[theme])
  listeners.forEach((l) => l())
}

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* storage blocked — theme still applies for this visit */
  }
  apply(theme)
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark')
}

// Light is the default (see index.html); the theme only changes when the user picks one.

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Current theme; re-renders when it changes. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => 'light')
}
