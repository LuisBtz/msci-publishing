/**
 * AEM URL helpers
 *
 * Pure functions that translate between public MSCI.com URLs and the
 * internal AEM content paths the author instance uses. These are the
 * authoritative mappers — duplicated historically in the article page
 * and in the /api/parse/docx route, now consolidated here.
 *
 *   getDisplayUrl — content path → public msci.com URL (for preview links)
 *   getAemPath    — any URL     → AEM content path (for internal references)
 *   toAemPath     — alias used by server-side related-resource mapping
 */

import { MSCI_CONTENT_ROOT, IPC_INDEXES_ROOT } from './constants'

export function getDisplayUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('/content/ipc/us/en/indexes')) {
    return `https://www.msci.com${url.replace('/content/ipc/us/en', '/indexes')}`
  }
  if (url.startsWith(MSCI_CONTENT_ROOT)) {
    return `https://www.msci.com${url.replace(MSCI_CONTENT_ROOT, '')}`
  }
  if (url.startsWith('/')) return `https://www.msci.com${url}`
  return url
}

export function getAemPath(url: string): string {
  if (!url) return url
  // Fix misrouted indexes paths (e.g. /content/msci/us/en/indexes/… → /content/ipc/us/en/indexes/…)
  if (url.startsWith(`${MSCI_CONTENT_ROOT}/indexes/`)) {
    return url.replace(MSCI_CONTENT_ROOT, IPC_INDEXES_ROOT.replace('/indexes', ''))
  }
  if (url.startsWith('/content/')) return url
  try {
    const parsed = new URL(url, 'https://www.msci.com')
    const hostname = parsed.hostname.toLowerCase()
    const pathname = parsed.pathname
    if (!hostname.endsWith('msci.com')) return url
    if (hostname === 'support.msci.com') return url
    if (pathname.startsWith('/indexes/index/')) return url
    if (pathname.startsWith('/indexes/')) return `${IPC_INDEXES_ROOT.replace('/indexes', '')}${pathname}`
    return `${MSCI_CONTENT_ROOT}${pathname}`
  } catch {
    return url
  }
}

// Alias kept for the server-side related-resource mapper which imported
// the previous implementation under this name.
export const toAemPath = getAemPath
