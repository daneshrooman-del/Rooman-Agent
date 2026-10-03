import { BarChart3, Bot, Clapperboard, FolderOpen, Home, Radio, Settings, UserRound, Video, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** short label for the mobile tab bar */
  short?: string
  /** where this sits in the identity → workforce hierarchy */
  layer?: string
  end?: boolean
}

/** The identity flow: Avatar → Video → Live → Agents */
export const primaryNav: NavItem[] = [
  { to: '/workspace', label: 'Home', icon: Home, end: true },
  { to: '/avatars', label: 'My Avatars', short: 'Avatars', icon: UserRound, layer: 'Identity' },
  { to: '/create', label: 'Create Video', short: 'Create', icon: Clapperboard, layer: 'Content' },
  { to: '/live', label: 'Live AI', short: 'Live', icon: Radio, layer: 'Interaction' },
  { to: '/agents', label: 'My Agents', short: 'Agents', icon: Bot, layer: 'Workforce' },
]

export const libraryNav: NavItem[] = [
  { to: '/videos', label: 'Videos', icon: Video },
  { to: '/assets', label: 'Assets', icon: FolderOpen },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
]

export const settingsNav: NavItem = { to: '/settings', label: 'Settings', icon: Settings }
