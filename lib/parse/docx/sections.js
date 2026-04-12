/**
 * Section slicers
 *
 * Splits the raw mammoth text of an MSCI intake document into the
 * three coarse regions expected by the Claude prompt: META (headline,
 * authors, format), BODY (bullets + article body) and END (related
 * resources, disclaimer). Uses well-known anchor phrases from the
 * template as split points.
 */

export function extractMetaSection(text) {
  const bulletStart = text.indexOf('Three bullet points:')
  return bulletStart === -1 ? text.substring(0, 3000) : text.substring(0, bulletStart)
}

export function extractBodySection(text) {
  const start = text.indexOf('Three bullet points:')
  const end = text.indexOf('Related resources:')
  if (start === -1) return ''
  return text.substring(start, end === -1 ? undefined : end)
}

export function extractEndSection(text) {
  const start = text.indexOf('Related resources:')
  if (start === -1) return ''
  const end = text.indexOf('Social media')
  return text.substring(start, end === -1 ? start + 3000 : end)
}
