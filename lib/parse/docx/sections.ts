export function extractMetaSection(text: string): string {
  const bulletStart = text.indexOf('Three bullet points:')
  return bulletStart === -1 ? text.substring(0, 3000) : text.substring(0, bulletStart)
}

export function extractBodySection(text: string): string {
  const start = text.indexOf('Three bullet points:')
  const end = text.indexOf('Related resources:')
  if (start === -1) return ''
  return text.substring(start, end === -1 ? undefined : end)
}

export function extractEndSection(text: string): string {
  const start = text.indexOf('Related resources:')
  if (start === -1) return ''
  const end = text.indexOf('Social media')
  return text.substring(start, end === -1 ? start + 3000 : end)
}
