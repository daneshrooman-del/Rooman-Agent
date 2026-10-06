import { useEffect, useMemo, useState, type RefObject } from 'react'

export interface Word {
  text: string
  start: number
  end: number
}

/** Word timestamps written next to a clip (`clip.mp4` → `clip.words.json`). */
export function useClipWords(src?: string) {
  const [words, setWords] = useState<Word[]>([])
  useEffect(() => {
    setWords([])
    if (!src) return
    let cancelled = false
    fetch(src.replace(/\.mp4$/, '.words.json'))
      .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : Promise.reject()))
      .then((d: { words: Word[] }) => !cancelled && setWords(d.words))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [src])
  return words
}

/** Index of the word being spoken (-1 in silences), following the video every frame. */
export function useCurrentWord(videoRef: RefObject<HTMLVideoElement | null>, words: Word[], src?: string) {
  const [current, setCurrent] = useState(-1)
  useEffect(() => {
    const v = videoRef.current
    setCurrent(-1)
    if (!v || !words.length) return
    let raf = 0
    const tick = () => {
      const t = v.currentTime
      let lo = 0
      let hi = words.length - 1
      let i = -1
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (words[mid].start <= t) {
          i = mid
          lo = mid + 1
        } else hi = mid - 1
      }
      // clear during long pauses once the last word has been said
      setCurrent(i >= 0 && t > words[i].end + 0.8 ? -1 : i)
      if (!v.paused && !v.ended) raf = requestAnimationFrame(tick)
    }
    const start = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(tick)
    }
    for (const e of ['play', 'seeked', 'timeupdate', 'loadeddata']) v.addEventListener(e, start)
    start()
    return () => {
      cancelAnimationFrame(raf)
      for (const e of ['play', 'seeked', 'timeupdate', 'loadeddata']) v.removeEventListener(e, start)
    }
  }, [videoRef, words, src])
  return current
}

/** Group words into caption lines: break after sentence ends, long pauses, or `maxWords`. */
function toLines(words: Word[], maxWords: number): Word[][] {
  const lines: Word[][] = []
  let line: Word[] = []
  words.forEach((w, i) => {
    line.push(w)
    const next = words[i + 1]
    if (/[.!?]["')\]]?$/.test(w.text) || (next ? next.start - w.end > 0.6 : true) || line.length >= maxWords) {
      lines.push(line)
      line = []
    }
  })
  if (line.length) lines.push(line)
  return lines
}

/** The current caption line, with the spoken word highlighted. */
export function WordCaption({
  words,
  current,
  maxWords = 7,
  className = '',
  size = 'sm',
}: {
  words: Word[]
  current: number
  maxWords?: number
  className?: string
  size?: 'sm' | 'lg'
}) {
  const lines = useMemo(() => toLines(words, maxWords), [words, maxWords])
  if (current < 0 || !lines.length) return null
  let first = 0
  let line = lines[0]
  for (const l of lines) {
    if (current < first + l.length) {
      line = l
      break
    }
    first += l.length
  }
  return (
    <div className={`pointer-events-none flex justify-center ${className}`} aria-hidden="true">
      <p
        className={`max-w-[95%] rounded-lg bg-black/70 text-center font-medium leading-relaxed backdrop-blur-sm ${
          size === 'lg' ? 'px-3 py-1.5 text-[15px] sm:text-[17px]' : 'px-2 py-1 text-[11px] sm:text-[12px]'
        }`}
      >
        {line.map((w, i) => {
          const idx = first + i
          const state = idx < current ? 'spoken' : idx === current ? 'now' : 'next'
          return (
            <span
              key={idx}
              className={`mx-[1px] inline-block rounded px-[3px] transition-colors duration-75 ${
                state === 'now' ? 'bg-accent text-white' : state === 'spoken' ? 'text-white' : 'text-white/45'
              }`}
            >
              {w.text}
            </span>
          )
        })}
      </p>
    </div>
  )
}
