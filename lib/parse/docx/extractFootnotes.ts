import JSZip from 'jszip'

interface Footnote {
  number: number
  text: string
}

export async function extractFootnotesFromDocx(buffer: Buffer): Promise<Footnote[]> {
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
