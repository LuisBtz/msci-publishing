import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import mammoth from 'mammoth'
import Anthropic from '@anthropic-ai/sdk'

import { readSharepointFolder } from '@/app/api/sharepoint/folder/route'
import { downloadFile } from '@/lib/graph'
import { extractDocxXml } from '@/lib/parse/docx/extractXml'
import { extractFootnotesFromDocx } from '@/lib/parse/docx/extractFootnotes'
import { extractHyperlinksFromDocx } from '@/lib/parse/docx/extractHyperlinks'
import { extractTagsFromXml } from '@/lib/parse/docx/extractTagsFromXml'
import {
  extractMetaSection,
  extractBodySection,
  extractEndSection,
} from '@/lib/parse/docx/sections'
import { parseJson } from '@/lib/parse/docx/parseJson'
import {
  buildExtractionPrompt,
  buildTagsPrompt,
  buildExhibitsContext,
  buildHyperlinksContext,
} from '@/lib/parse/docx/prompts'

import { generateSlug } from '@/lib/articles/generateSlug'
import { buildAuthors } from '@/lib/articles/buildAuthors'
import { buildArticleFinalUrl } from '@/lib/articles/finalUrl'
import { toAemPath } from '@/lib/aem/urls'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const CLAUDE_MODEL = 'claude-sonnet-4-6'

function md5(text: string): string {
  return createHash('md5').update(text).digest('hex')
}

function stripAndNorm(s: string): string {
  return (s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function norm(s: string): string {
  return (s || '').replace(/\s+/g, ' ').trim()
}

function diffScalar(a: unknown, b: unknown): boolean {
  return norm(String(a ?? '')) !== norm(String(b ?? ''))
}

function diffStringArray(oldArr: string[], newArr: string[]): boolean[] {
  const oldSafe = Array.isArray(oldArr) ? oldArr : []
  const newSafe = Array.isArray(newArr) ? newArr : []
  const max = Math.max(oldSafe.length, newSafe.length)
  const changed = []
  for (let i = 0; i < max; i++) {
    changed.push(stripAndNorm(oldSafe[i]) !== stripAndNorm(newSafe[i]))
  }
  return changed
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function diffBodyBlocks(oldBlocks: any[], newBlocks: any[]): boolean[] {
  const oldSafe = Array.isArray(oldBlocks) ? oldBlocks : []
  const newSafe = Array.isArray(newBlocks) ? newBlocks : []
  const max = Math.max(oldSafe.length, newSafe.length)
  const changed = []
  for (let i = 0; i < max; i++) {
    const a = oldSafe[i]
    const b = newSafe[i]
    if (!a || !b) {
      changed.push(true)
    } else if (a.type !== b.type) {
      changed.push(true)
    } else if (a.type === 'text') {
      // Compare stripped plain-text to ignore HTML formatting variance
      changed.push(stripAndNorm(a.html) !== stripAndNorm(b.html))
    } else if (a.type === 'exhibit') {
      changed.push(
        stripAndNorm(a.title) !== stripAndNorm(b.title) ||
        stripAndNorm(a.caption) !== stripAndNorm(b.caption) ||
        a.sharepoint_index !== b.sharepoint_index
      )
    } else {
      changed.push(JSON.stringify(a) !== JSON.stringify(b))
    }
  }
  return changed
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function diffFootnotes(oldFn: any[], newFn: any[]): boolean[] {
  const oldSafe = Array.isArray(oldFn) ? oldFn : []
  const newSafe = Array.isArray(newFn) ? newFn : []
  const max = Math.max(oldSafe.length, newSafe.length)
  const changed = []
  for (let i = 0; i < max; i++) {
    const a = oldSafe[i]
    const b = newSafe[i]
    changed.push(!a || !b || stripAndNorm(a.text) !== stripAndNorm(b.text))
  }
  return changed
}

export async function POST(req: Request) {
  try {
    const { articleId } = await req.json()
    if (!articleId) {
      return NextResponse.json({ error: 'articleId requerido' }, { status: 400 })
    }

    // 1. Load current article
    const { data: article, error: fetchErr } = await supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single()
    if (fetchErr || !article) {
      return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 })
    }
    if (!article.sharepoint_folder_url) {
      return NextResponse.json(
        { error: 'No hay URL de SharePoint configurada para este artículo' },
        { status: 400 }
      )
    }

    // 2. Re-read SharePoint folder
    const { docxFile, exhibitPaths } = await readSharepointFolder(
      article.sharepoint_folder_url
    )
    if (!docxFile) {
      return NextResponse.json(
        { error: 'No se encontró el documento de intake en SharePoint' },
        { status: 404 }
      )
    }

    // 3. Download and extract docx
    const docxBuffer = await downloadFile(docxFile.id)
    const buffer = Buffer.from(docxBuffer)

    const { value: docText } = await mammoth.extractRawText({ buffer })
    const docXml = await extractDocxXml(buffer)
    const tagsText = extractTagsFromXml(docXml)

    const footnotesFromXml = await extractFootnotesFromDocx(buffer)
    const hyperlinksFromDocx = await extractHyperlinksFromDocx(buffer)

    const metaSection = extractMetaSection(docText)
    const bodySection = extractBodySection(docText)
    const endSection = extractEndSection(docText)

    // Hash of the body section raw text — deterministic way to detect changes
    const newBodyHash = md5(bodySection)
    const oldBodyHash = article._body_hash || null

    console.log('[reprocess] docx file:', docxFile.name, '| lastModified:', docxFile.lastModifiedDateTime)
    console.log('[reprocess] body section length:', bodySection.length, '| hash:', newBodyHash)
    console.log('[reprocess] old body hash:', oldBodyHash)
    console.log('[reprocess] raw text changed (hash):', newBodyHash !== oldBodyHash)

    const exhibitsSummary = exhibitPaths
    const exhibitsContext = buildExhibitsContext(exhibitsSummary)
    const hyperlinksContext = buildHyperlinksContext(hyperlinksFromDocx)

    // 4. Two Claude calls (same as initial parse)
    const [message1, message2] = await Promise.all([
      anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        messages: [
          {
            role: 'user',
            content: buildExtractionPrompt({
              metaSection,
              bodySection,
              endSection,
              exhibitsContext,
              hyperlinksContext,
            }),
          },
        ],
      }),
      anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1000,
        messages: [{ role: 'user', content: buildTagsPrompt(tagsText) }],
      }),
    ])

    const block1 = message1.content[0] as { text: string }
    let parsed
    try {
      parsed = parseJson(block1.text)
    } catch {
      console.error('[reprocess] JSON parse failed:', block1.text.substring(0, 500))
      throw new Error('Error al parsear respuesta de Claude. Intenta de nuevo.')
    }

    let tags = { all_tags: [] as string[] }
    try {
      tags = parseJson((message2.content[0] as { text: string }).text)
    } catch {}

    // Normalize href paths inside body text blocks
    if (parsed.body_blocks) {
      parsed.body_blocks = parsed.body_blocks.map((block) => {
        if (block.type !== 'text' || !block.html) return block
        return {
          ...block,
          html: block.html.replace(/href="([^"]+)"/g, (_m, url) => {
            return `href="${toAemPath(url)}"`
          }),
        }
      })
    }

    // Enrich body_blocks with SharePoint items
    if (parsed.body_blocks && exhibitsSummary?.items) {
      parsed.body_blocks = parsed.body_blocks.map((block) => {
        if (block.type !== 'exhibit') return block
        const item = exhibitsSummary.items[block.sharepoint_index]
        if (!item) return { ...block, sharepoint_data: null }
        return { ...block, sharepoint_data: item, exhibit_type: item.type }
      })
    }

    const slug = generateSlug(parsed.headline)
    const final_url = buildArticleFinalUrl(parsed.type, slug)
    const authors = buildAuthors(parsed.authors)
    const finalFootnotes =
      footnotesFromXml.length > 0 ? footnotesFromXml : parsed.footnotes || []

    const allRelated = (parsed.related_resources || []).map((r) => ({
      ...r,
      original_url: r.url,
      aem_path: toAemPath(r.url),
    }))
    const relatedResources = allRelated.slice(0, 3)

    const newData = {
      ...parsed,
      related_resources: relatedResources,
      authors,
      tags,
      slug,
      final_url,
      footnotes: finalFootnotes,
    }

    // 5. Compute diff — field-by-field comparison
    const bulletsDiff = diffStringArray(article.bullets, newData.bullets)
    const blocksDiff = diffBodyBlocks(article.body_blocks, newData.body_blocks)
    const footnotesDiff = diffFootnotes(article.footnotes, newData.footnotes)

    const headlineChanged = diffScalar(article.headline, newData.headline)
    const slugChanged = diffScalar(article.slug, newData.slug)
    const urlChanged = diffScalar(article.final_url, newData.final_url)
    const metaDescChanged = diffScalar(article.meta_description, newData.meta_description)
    const readTimeChanged = String(article.read_time ?? '') !== String(newData.read_time ?? '')
    const typeChanged = (article.type || '') !== (newData.type || '')

    // If the raw body text changed but Claude produced similar HTML,
    // force-flag ALL body blocks as changed so user sees the diff
    const rawTextChanged = oldBodyHash != null && newBodyHash !== oldBodyHash
    const rawTextFirstProcess = oldBodyHash == null
    const bodyBlocksChanged = rawTextChanged
      ? (newData.body_blocks || []).map(() => true)
      : blocksDiff

    console.log('[reprocess] field diffs:', {
      headline: headlineChanged,
      slug: slugChanged,
      meta_description: metaDescChanged,
      read_time: readTimeChanged,
      type: typeChanged,
      bullets: bulletsDiff,
      body_blocks_field: blocksDiff,
      body_blocks_forced: rawTextChanged,
      footnotes: footnotesDiff,
    })

    const changes = {
      headline: headlineChanged,
      slug: slugChanged,
      final_url: urlChanged,
      meta_description: metaDescChanged,
      read_time: readTimeChanged,
      type: typeChanged,
      bullets: bulletsDiff,
      body_blocks: bodyBlocksChanged,
      footnotes: footnotesDiff,
      has_any_change: false,
    }

    changes.has_any_change =
      changes.headline ||
      changes.slug ||
      changes.final_url ||
      changes.meta_description ||
      changes.read_time ||
      changes.type ||
      changes.bullets.some(Boolean) ||
      changes.body_blocks.some(Boolean) ||
      changes.footnotes.some(Boolean) ||
      rawTextChanged ||
      rawTextFirstProcess

    // 6. Always update the article (so data stays fresh) + save body hash
    const updatePayload = {
      headline: newData.headline,
      slug: newData.slug,
      final_url: newData.final_url,
      meta_description: newData.meta_description,
      read_time: newData.read_time,
      type: newData.type,
      bullets: newData.bullets || [],
      body_blocks: newData.body_blocks || [],
      footnotes: newData.footnotes || [],
      authors: newData.authors || [],
      tags: newData.tags || {},
      related_resources: newData.related_resources || [],
      _body_hash: newBodyHash,
    }
    await supabase.from('articles').update(updatePayload).eq('id', articleId)

    return NextResponse.json({ newData, changes })
  } catch (err) {
    console.error('Reprocess error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
