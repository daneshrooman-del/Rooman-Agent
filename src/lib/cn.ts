/** Tiny className joiner — avoids pulling in clsx/tailwind-merge. */
export function cn(...parts: Array<string | false | null | undefined | 0>) {
  return parts.filter(Boolean).join(' ')
}

/** 'relative' unless the caller already positions the element (cn() does not dedupe). */
export function positioned(className?: string) {
  return className && /(^|\s)!?(absolute|fixed|sticky)(\s|$)/.test(className) ? '' : 'relative'
}
