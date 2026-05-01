import JSZip from 'jszip'

export async function extractDocxXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const docXml = await zip.file('word/document.xml').async('string')
  return docXml
}
