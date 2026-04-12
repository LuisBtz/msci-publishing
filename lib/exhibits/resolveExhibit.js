/**
 * resolveExhibit
 *
 * Given an exhibit body-block and the full exhibit_paths structure for
 * the article, return the concrete exhibit (with its files) that the
 * block points at. Handles both the current items[] model and the
 * legacy statics/interactives/summary shape for backward compatibility.
 *
 * This was previously duplicated in page.js and TabPreview.js; this
 * module is the single source of truth.
 */

export function resolveExhibit(block, exhibitPaths) {
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
