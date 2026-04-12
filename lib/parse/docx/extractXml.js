/**
 * extractDocxXml
 *
 * Opens a .docx zip and returns the raw word/document.xml contents as
 * a string. Used as the starting point for any XML-level extraction
 * (hyperlinks, tags, etc.) in the /api/parse/docx pipeline.
 */
import JSZip from 'jszip'

export async function extractDocxXml(buffer) {
  const zip = await JSZip.loadAsync(buffer)
  const docXml = await zip.file('word/document.xml').async('string')
  return docXml
}
