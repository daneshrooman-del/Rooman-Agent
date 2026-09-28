import { AudioLines, FileText, Film, Image as ImageIcon, ScanFace, type LucideIcon } from 'lucide-react'
import type { Asset, AssetKind, Scene } from '@/types'

/** Asset as held on the Assets page — uploads carry a transient processing state. */
export interface LibraryAsset extends Asset {
  status?: 'processing' | 'ready'
  progress?: number
}

export type AssetCategory = 'all' | AssetKind
export type AssetSort = 'newest' | 'name' | 'size'

export const categories: { value: AssetCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Videos' },
  { value: 'audio', label: 'Audio' },
  { value: 'avatar', label: 'Avatars' },
  { value: 'document', label: 'Documents' },
  { value: 'image', label: 'Images' },
]

export const kindLabel: Record<AssetKind, string> = {
  video: 'Video',
  audio: 'Audio',
  avatar: 'Avatar',
  document: 'Document',
  image: 'Image',
}

export const kindIcon: Record<AssetKind, LucideIcon> = {
  video: Film,
  audio: AudioLines,
  avatar: ScanFace,
  document: FileText,
  image: ImageIcon,
}

/** Stable small hash so generated visuals stay the same across renders. */
export function hashString(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic pseudo-random generator seeded from a string. */
export function seeded(seed: string) {
  let x = hashString(seed) || 1
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return ((x >>> 0) % 10_000) / 10_000
  }
}

export function fileExt(name: string) {
  const m = /\.([a-z0-9]{2,5})$/i.exec(name)
  return m ? m[1].toUpperCase() : ''
}

export function baseName(name: string) {
  const ext = fileExt(name)
  return ext ? name.slice(0, -(ext.length + 1)) : name
}

export function sceneFor(asset: Asset): Scene {
  const scenes: Scene[] = ['studio', 'office', 'custom']
  return scenes[hashString(asset.id) % scenes.length]
}

export function kindFromFile(file: File): AssetKind {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('image/')) return 'image'
  return 'document'
}

export function sortAssets<T extends Asset>(list: T[], sort: AssetSort) {
  const out = [...list]
  if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name))
  else if (sort === 'size') out.sort((a, b) => b.sizeBytes - a.sizeBytes)
  else out.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  return out
}
