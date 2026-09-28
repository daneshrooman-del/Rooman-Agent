import { useCallback } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useWorkspace } from '@/state/workspace'
import type { Video } from '@/types'
import { videoShareUrl } from './studio'

/** Share / download / duplicate — shared by the studio and the library. */
export function useVideoActions() {
  const toast = useToast()
  const { addVideo, isDemo } = useWorkspace()

  const share = useCallback(
    async (v: Video) => {
      const url = videoShareUrl(v.id)
      try {
        await navigator.clipboard.writeText(url)
        toast({ title: 'Link copied', description: `Anyone in your workspace can watch “${v.title}”.` })
      } catch {
        toast({ title: 'Share link', description: url, tone: 'info' })
      }
    },
    [toast],
  )

  const download = useCallback(
    (v: Video) => {
      if (v.url) {
        const a = document.createElement('a')
        a.href = v.url
        a.download = `${v.title}.mp4`
        a.click()
        toast({ title: 'Download started', description: `${v.title}.mp4` })
        return
      }
      toast({
        title: isDemo ? 'Download prepared' : 'Preparing download',
        description: isDemo ? `${v.title}.mp4 · demo videos have no media file yet.` : `${v.title}.mp4 will download shortly.`,
        tone: 'info',
      })
    },
    [toast, isDemo],
  )

  const duplicate = useCallback(
    (v: Video) => {
      const copy: Video = {
        ...v,
        id: `vid_${Date.now().toString(36)}`,
        title: `${v.title} (copy)`,
        createdAt: new Date().toISOString(),
      }
      addVideo(copy)
      toast({ title: 'Video duplicated', description: copy.title })
      return copy
    },
    [addVideo, toast],
  )

  return { share, download, duplicate }
}
