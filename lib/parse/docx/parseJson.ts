// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseJson(raw: string): any {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch (firstErr) {
    try {
      return JSON.parse(escapeControlCharsInStrings(cleaned))
    } catch {
      throw firstErr
    }
  }
}

function escapeControlCharsInStrings(text: string): string {
  let out = ''
  let inString = false
  let escape = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (escape) {
      out += c
      escape = false
      continue
    }
    if (c === '\\') {
      out += c
      escape = true
      continue
    }
    if (c === '"') {
      inString = !inString
      out += c
      continue
    }
    if (inString) {
      const code = c.charCodeAt(0)
      if (code < 0x20) {
        if (c === '\n') out += '\\n'
        else if (c === '\r') out += '\\r'
        else if (c === '\t') out += '\\t'
        else out += '\\u' + code.toString(16).padStart(4, '0')
        continue
      }
    }
    out += c
  }
  return out
}
