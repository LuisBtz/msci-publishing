import type { ExhibitBlock, ExhibitPaths } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveExhibit(block: ExhibitBlock & { exhibit_index?: number }, exhibitPaths: ExhibitPaths | null | undefined): any {
  if (!exhibitPaths) return null
  const idx = block.sharepoint_index ?? block.exhibit_index
  if (idx == null) return null

  // Current format: items[] is authoritative, ordered by filename suffix.
  if (Array.isArray(exhibitPaths.items)) {
    const item = exhibitPaths.items[idx]
    return item ? { ...item, exhibit_type: item.type } : null
  }

  // Legacy fallback.
  const { statics = [], interactives = [], summary = [] } = exhibitPaths
  const summaryItem = summary[idx]
  if (!summaryItem) return null
  if (summaryItem.type === 'static') {
    const s = statics[idx]
    return s ? { ...s, exhibit_type: 'static' } : null
  }
  if (summaryItem.type === 'interactive') {
    const iIdx = idx - statics.length
    const iv = interactives[iIdx]
    return iv ? { ...iv, exhibit_type: 'interactive' } : null
  }
  return null
}
