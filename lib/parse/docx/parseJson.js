/**
 * parseJson
 *
 * Parses the JSON body returned by Claude, stripping optional
 * ```json fences and — as a fallback — escaping raw control
 * characters that Claude occasionally leaves inside strings. Throws
 * the raw JSON.parse error if both attempts fail so the caller can
 * log the offending payload.
 */
export function parseJson(raw) {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const repaired = cleaned.replace(/[\u0000-\u001F]/g, (m) => {
      if (m === '\n') return '\\n'
      if (m === '\r') return '\\r'
      if (m === '\t') return '\\t'
      return ''
    })
    return JSON.parse(repaired)
  }
}
