import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Asset } from '@/types'
import { kindFromFile, type LibraryAsset } from './assetMeta'

/**
 * Local working copy of the workspace's assets so the page can rename,
 * delete and upload optimistically. Every change goes through `api.*`.
 */
export function useAssetLibrary(initial: Asset[]) {
  const [assets, setAssets] = useState<LibraryAsset[]>(() => initial.map((a) => ({ ...a, status: 'ready' })))
  const processing = assets.some((a) => a.status === 'processing')

  // Drive processing → ready for fresh uploads (replace with server events when a backend is wired).
  useEffect(() => {
    if (!processing) return
    const t = window.setInterval(() => {
      setAssets((list) =>
        list.map((a) => {
          if (a.status !== 'processing') return a
          const progress = Math.min(100, (a.progress ?? 0) + 6 + Math.round(Math.random() * 10))
          return progress >= 100 ? { ...a, progress: 100, status: 'ready' } : { ...a, progress }
        }),
      )
    }, 350)
    return () => window.clearInterval(t)
  }, [processing])

  const upload = async (files: File[]) => {
    const created = await Promise.all(files.map((f) => api.uploadAsset(f, kindFromFile(f))))
    setAssets((list) => [...created.map<LibraryAsset>((a) => ({ ...a, status: 'processing', progress: 0 })), ...list])
    return created
  }

  const rename = async (id: string, name: string) => {
    await api.renameAsset(id, name)
    setAssets((list) => list.map((a) => (a.id === id ? { ...a, name } : a)))
  }

  const remove = async (id: string) => {
    await api.deleteAsset(id)
    setAssets((list) => list.filter((a) => a.id !== id))
  }

  return { assets, upload, rename, remove }
}
