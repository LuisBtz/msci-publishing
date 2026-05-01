export function extractTagsFromXml(xml: string): string {
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
