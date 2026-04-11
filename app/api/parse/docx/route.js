import { NextResponse } from 'next/server'
import mammoth from 'mammoth'
import Anthropic from '@anthropic-ai/sdk'
import JSZip from 'jszip'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function extractDocxXml(buffer) {
  const zip = await JSZip.loadAsync(buffer)
  const docXml = await zip.file('word/document.xml').async('string')
  return docXml
}

async function extractFootnotesFromDocx(buffer) {
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
      let text = noteXml
        .replace(/<w:rPr[^>]*>[\s\S]*?<\/w:rPr>/g, '')
        .replace(/<w:footnoteRef\/>|<w:endnoteRef\/>/g, '')
        .replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#xD;/g, '')
        .replace(/\s+/g, ' ').trim()
      if (text) results.push({ number: noteId, text })
    }
  }

  results.sort((a, b) => a.number - b.number)
  return results.map((f, i) => ({ ...f, number: i + 1 }))
}

// NEW: Extrae hyperlinks reales del XML del docx (text visible → URL completa)
async function extractHyperlinksFromDocx(buffer) {
  const zip = await JSZip.loadAsync(buffer)

  const relsFile = zip.file('word/_rels/document.xml.rels')
  if (!relsFile) return []

  const relsXml = await relsFile.async('string')

  // Mapa rId → URL target
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

function toAemPath(url) {
  if (!url) return url
  try {
    const u = new URL(url)
    if (!u.hostname.includes('msci.com')) return url
    if (u.hostname.includes('support.msci.com')) return url
    const path = u.pathname
    if (/\/indexes\/index\/\d+/.test(path)) return url
    if (path.startsWith('/indexes/')) return `/content/ipc/us/en${path}`
    return `/content/msci/us/en${path}`
  } catch {
    return url
  }
}

function extractTagsFromXml(xml) {
  const tagsStart = xml.indexOf('>Tags<')
  const placementEnd = xml.indexOf('>Placement on MSCI.com<')
  if (tagsStart === -1) return ''
  const tagsXml = xml.substring(tagsStart, placementEnd === -1 ? tagsStart + 50000 : placementEnd)
  return tagsXml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#9746;/g, '☒').replace(/&#9744;/g, '☐')
    .replace(/\s+/g, ' ').trim()
}

function extractMetaSection(text) {
  const bulletStart = text.indexOf('Three bullet points:')
  return bulletStart === -1 ? text.substring(0, 3000) : text.substring(0, bulletStart)
}

function extractBodySection(text) {
  const start = text.indexOf('Three bullet points:')
  const end = text.indexOf('Related resources:')
  if (start === -1) return ''
  return text.substring(start, end === -1 ? undefined : end)
}

function extractEndSection(text) {
  const start = text.indexOf('Related resources:')
  if (start === -1) return ''
  const end = text.indexOf('Social media')
  return text.substring(start, end === -1 ? start + 3000 : end)
}

function parseJson(raw) {
  const cleaned = raw
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const repaired = cleaned.replace(/[\u0000-\u001F]/g, m => {
      if (m === '\n') return '\\n'
      if (m === '\r') return '\\r'
      if (m === '\t') return '\\t'
      return ''
    })
    return JSON.parse(repaired)
  }
}

export async function POST(req) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const exhibitsSummaryRaw = formData.get('exhibits')
    const exhibitsSummary = exhibitsSummaryRaw ? JSON.parse(exhibitsSummaryRaw) : null

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const { value: docText } = await mammoth.extractRawText({ buffer })
    const docXml = await extractDocxXml(buffer)
    const tagsText = extractTagsFromXml(docXml)

    const footnotesFromXml = await extractFootnotesFromDocx(buffer)
    const hyperlinksFromDocx = await extractHyperlinksFromDocx(buffer) // NEW

    const metaSection = extractMetaSection(docText)
    const bodySection = extractBodySection(docText)
    const endSection = extractEndSection(docText)

    const exhibitsContext = exhibitsSummary?.summary?.length
      ? `\nEXHIBITS AVAILABLE IN SHAREPOINT (ordered by filename suffix — position in list = order in blog post):
${exhibitsSummary.summary.map((e, i) =>
  e.type === 'static'
    ? `Index ${i}: [STATIC] base_name: "${e.base_name}" | desktop: "${e.desktop_filename}"`
    : `Index ${i}: [INTERACTIVE] base_name: "${e.base_name}" | json: "${e.json_filename}"`
).join('\n')}`
      : '\nNo exhibits found in SharePoint for this project.'

    // NEW: Contexto de hyperlinks para Claude
    const hyperlinksContext = hyperlinksFromDocx.length
      ? `\nHYPERLINKS EXTRACTED FROM DOCUMENT (use these exact URLs — do not truncate or reconstruct):
${hyperlinksFromDocx.map((l, i) => `${i + 1}. text: "${l.text}" | url: "${l.url}"`).join('\n')}`
      : ''

    // ── LLAMADA 1 ─────────────────────────────────────────────────────────────
    const message1 = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      messages: [{
        role: 'user',
        content: `Extract structured data from this MSCI Research intake document. Return ONLY valid JSON, no markdown, no backticks.

CRITICAL: Properly escape all strings. No raw newlines inside JSON strings.

Extract these fields:

- type: from the META SECTION, find which Format option is checked (☒). Return one of: "blog-post", "paper", "quick-take", "podcast"

- headline: from "Headline:" field in META SECTION

- read_time: number only from "Read Time:" (e.g. "6 minutes" → "6"). null if absent.

- meta_description: Look in END SECTION for "Our latest research" summary copy field. The value is the text immediately after that label.

- authors: array of {name: string} from "Author(s):" in META SECTION

- bullets: array of strings from "Three bullet points:" section

- body_blocks: Parse the BODY SECTION and create an ORDERED array of blocks alternating text and exhibits IN THE EXACT ORDER they appear in the document.

  TEXT BLOCKS: { "type": "text", "html": "..." }
  * paragraphs → <p>, section titles (bold standalone lines) → <h2>
  * bold → <strong>, italic → <em>, footnote refs → <sup>N</sup>
  * links → <a href="URL">text</a>
  * LINK RULES:
    - msci.com/indexes/ (no numeric ID) → /content/ipc/us/en/indexes/[path]
    - msci.com/indexes/index/[NUMERIC_ID] → keep absolute
    - any other msci.com URL → /content/msci/us/en/[path]
    - support.msci.com → keep absolute
    - external URLs → keep absolute + target="_blank"
  * For body links: look up the anchor text in the HYPERLINKS list and use the full URL from there
  * Group consecutive paragraphs together into ONE text block
  * STOP the text block when you hit an image reference (![](media/imageN.png))
  * Do NOT include exhibit titles or captions in text blocks

  EXHIBIT BLOCKS: { "type": "exhibit", "title": "...", "caption": "...", "sharepoint_index": N, "match_confidence": "high" }
  * Whenever you encounter an image reference (![](media/imageN.png)), create an exhibit block
  * "title": the BOLD text immediately BEFORE the image — this is the exhibit title
  * "caption": the text in a different/smaller style immediately AFTER the image (usually a data source note). null if none exists.
  * "sharepoint_index": ASSIGN SEQUENTIALLY based on the ORDER the image appears in the document.
    - The FIRST image/exhibit in the document → sharepoint_index 0
    - The SECOND image/exhibit → sharepoint_index 1
    - The THIRD → sharepoint_index 2, and so on
    - This works because the SharePoint file list below is already sorted by the numeric order suffix in each filename (which matches appearance order in the blog post).
    - Do NOT try to match by title keywords. Just use the zero-based position of the image in the document.
  * "match_confidence": always "high"
${exhibitsContext}

- footnotes: array of {number: int, text: string} from end of document. Preserve <em> and links.

- related_resources: array of {title: string, url: string, cta_label: string} from END SECTION "Related resources:".
  IMPORTANT: For each related resource, match the title or link text to the HYPERLINKS list below and use the full URL from there.
  Never truncate or reconstruct URLs — always use the exact URL from the HYPERLINKS list.
  cta_label: "Read more" blogs/papers, "Learn more" podcasts, "Explore more" products/indexes/frameworks.

- sharepoint_folder_url: null

META SECTION:
${metaSection}

BODY SECTION:
${bodySection}

END SECTION:
${endSection}
${hyperlinksContext}

Return ONLY the JSON object.`
      }]
    })

    // ── LLAMADA 2: tags ───────────────────────────────────────────────────────
    const message2 = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Extract checked tags from this MSCI document tags section. Return ONLY valid JSON.

☒ = CHECKED (selected), ☐ = UNCHECKED. Only extract ☒ items.

Build {"all_tags": [...]} with format "Category : Value":
- "Asset Class" → "Asset Class : [value]"
- "Line of business" → "Line of Business : [value]"
- "Theme" → "Theme : [value]"
- "Topic" → "Topic : [value]"
- "Marketing Programs" → "Marketing Program : [value]"
- "Campaigns" → "Campaign : [value]"
- "Type" → "Research Type : [value]"
- DO NOT include "Format" section items

TAGS TEXT:
${tagsText}

Return ONLY: {"all_tags": ["Tag 1", "Tag 2", ...]}`
      }]
    })

    // ── Parsear respuestas ────────────────────────────────────────────────────
    let parsed
    try {
      parsed = parseJson(message1.content[0].text)
    } catch (e) {
      console.error('JSON parse failed:', message1.content[0].text.substring(0, 500))
      throw new Error('Error al parsear respuesta de Claude. Intenta de nuevo.')
    }

    let tags = { all_tags: [] }
    try {
      tags = parseJson(message2.content[0].text)
    } catch {
      console.error('Tags parse failed')
    }

    // ── Enriquecer body_blocks con datos reales de SharePoint ─────────────────
    // sharepoint_index es ahora la posición 0-based directa en items[].
    if (parsed.body_blocks && exhibitsSummary?.items) {
      parsed.body_blocks = parsed.body_blocks.map(block => {
        if (block.type !== 'exhibit') return block
        const idx = block.sharepoint_index
        const item = exhibitsSummary.items[idx]
        if (!item) return { ...block, sharepoint_data: null }
        return {
          ...block,
          sharepoint_data: item,
          exhibit_type: item.type
        }
      })
    }

    // ── Generar slug ──────────────────────────────────────────────────────────
    const slug = parsed.headline
      ?.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim() || ''

    const urlPrefixes = {
      'blog-post': '/research-and-insights/blog-post/',
      'paper': '/research-and-insights/paper/',
      'quick-take': '/research-and-insights/quick-take/',
      'podcast': '/research-and-insights/podcast/'
    }
    const final_url = `https://www.msci.com${urlPrefixes[parsed.type] || '/research-and-insights/blog-post/'}${slug}`

    // ── Generar content fragment paths para autores ───────────────────────────
    const authors = (parsed.authors || []).map(a => {
      const authorSlug = a.name
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
      return {
        name: a.name,
        slug: authorSlug,
        content_fragment_path: `/content/dam/web/msci-com/research-and-insights/contributor/${authorSlug}/${authorSlug}`,
        contributor_url: `/research-and-insights/contributor/${authorSlug}`,
        found: null
      }
    })

    const finalFootnotes = footnotesFromXml.length > 0 ? footnotesFromXml : (parsed.footnotes || [])

    // Apply AEM path rules to related resources — max 3
const allRelated = (parsed.related_resources || []).map(r => ({
  ...r,
  original_url: r.url,
  aem_path: toAemPath(r.url)
}))

const relatedResources = allRelated.slice(0, 3)
const relatedWarning = allRelated.length > 3
  ? `The document contained ${allRelated.length} related resources. Only the first 3 were included.`
  : null

return NextResponse.json({
  ...parsed,
  related_resources: relatedResources,
  related_warning: relatedWarning,
  authors,
  tags,
  slug,
  final_url,
  footnotes: finalFootnotes
})

  } catch (err) {
    console.error('Parse error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}