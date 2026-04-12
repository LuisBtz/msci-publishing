/**
 * extractHyperlinksFromDocx
 *
 * Walks the .docx relationships file to build a rId → target URL map
 * and pairs it with the visible text inside each <w:hyperlink> in the
 * document body. Returns the full list of { text, url } pairs so the
 * Claude prompt can lookup anchors exactly instead of letting the
 * model reconstruct URLs (which it truncates).
 */
import JSZip from 'jszip'

export async function extractHyperlinksFromDocx(buffer) {
  const zip = await JSZip.loadAsync(buffer)

  const relsFile = zip.file('word/_rels/document.xml.rels')
  if (!relsFile) return []

  const relsXml = await relsFile.async('string')

  const relsMap = {}
  const relRegex = /<Relationship\s+Id="([^"]+)"\s+[^>]*Target="([^"]+)"[^>]*\/?>/g
  let m
  while ((m = relRegex.exec(relsXml)) !== null) {
    relsMap[m[1]] = m[2]
  }

  const docXml = await zip.file('word/document.xml').async('string')
  const links = []
  const hyperlinkRegex = /<w:hyperlink\s[^>]*r:id="([^"]+)"[^>]*>([\s\S]*?)<\/w:hyperlink>/g

  while ((m = hyperlinkRegex.exec(docXml)) !== null) {
    const rId = m[1]
    const innerXml = m[2]
    const url = relsMap[rId]

    if (!url || !url.startsWith('http')) continue

    const text = innerXml
      .replace(/<w:rPr[^>]*>[\s\S]*?<\/w:rPr>/g, '')
      .replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (text && url) {
      links.push({ text, url })
    }
  }

  return links
}
