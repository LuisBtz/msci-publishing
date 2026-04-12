/**
 * extractFootnotesFromDocx
 *
 * Reads word/footnotes.xml and word/endnotes.xml from a .docx zip and
 * returns the flattened list of notes as { number, text } in document
 * order. The numbers are re-indexed from 1 so the output is stable
 * even when Word leaves gaps in the original note ids.
 */
import JSZip from 'jszip'

export async function extractFootnotesFromDocx(buffer) {
  const zip = await JSZip.loadAsync(buffer)
  const footnoteFile = zip.file('word/footnotes.xml')
  const endnoteFile = zip.file('word/endnotes.xml')
  const results = []

  for (const [file] of [[footnoteFile], [endnoteFile]]) {
    if (!file) continue
    const xml = await file.async('string')
    const noteRegex = /<w:(?:footnote|endnote)\s[^>]*w:id="(\d+)"[^>]*>([\s\S]*?)<\/w:(?:footnote|endnote)>/g
    let match
    while ((match = noteRegex.exec(xml)) !== null) {
      const noteId = parseInt(match[1])
      if (noteId <= 0) continue
      const noteXml = match[2]
      const text = noteXml
        .replace(/<w:rPr[^>]*>[\s\S]*?<\/w:rPr>/g, '')
        .replace(/<w:footnoteRef\/>|<w:endnoteRef\/>/g, '')
        .replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#xD;/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (text) results.push({ number: noteId, text })
    }
  }

  results.sort((a, b) => a.number - b.number)
  return results.map((f, i) => ({ ...f, number: i + 1 }))
}
