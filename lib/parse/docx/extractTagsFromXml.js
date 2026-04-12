/**
 * extractTagsFromXml
 *
 * Locates the "Tags" block inside the raw document XML and returns the
 * plain-text slice between "Tags" and "Placement on MSCI.com". The
 * output still contains ☒/☐ markers so the Claude prompt can tell
 * which tags the author actually checked.
 */
export function extractTagsFromXml(xml) {
  const tagsStart = xml.indexOf('>Tags<')
  const placementEnd = xml.indexOf('>Placement on MSCI.com<')
  if (tagsStart === -1) return ''
  const tagsXml = xml.substring(
    tagsStart,
    placementEnd === -1 ? tagsStart + 50000 : placementEnd
  )
  return tagsXml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#9746;/g, '☒')
    .replace(/&#9744;/g, '☐')
    .replace(/\s+/g, ' ')
    .trim()
}
