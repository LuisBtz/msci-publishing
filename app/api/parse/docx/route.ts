import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import mammoth from 'mammoth'
import Anthropic from '@anthropic-ai/sdk'

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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CLAUDE_MODEL = 'claude-sonnet-4-6'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const exhibitsSummaryRaw = formData.get('exhibits') as string | null
    const exhibitsSummary = exhibitsSummaryRaw ? JSON.parse(exhibitsSummaryRaw) : null

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const { value: docText } = await mammoth.extractRawText({ buffer })
    const docXml = await extractDocxXml(buffer)
    const tagsText = extractTagsFromXml(docXml)

    const footnotesFromXml = await extractFootnotesFromDocx(buffer)
    const hyperlinksFromDocx = await extractHyperlinksFromDocx(buffer)

    const metaSection = extractMetaSection(docText)
    const bodySection = extractBodySection(docText)
    const endSection = extractEndSection(docText)

    const exhibitsContext = buildExhibitsContext(exhibitsSummary)
    const hyperlinksContext = buildHyperlinksContext(hyperlinksFromDocx)

    // ── Call 1: structured extraction ─────────────────────────────────────────
    const message1 = await anthropic.messages.create({
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
    })

    // ── Call 2: tags ──────────────────────────────────────────────────────────
    const message2 = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: buildTagsPrompt(tagsText) }],
    })

    const block1 = message1.content[0] as { text: string }
    let parsed
    try {
      parsed = parseJson(block1.text)
    } catch (e) {
      const text = block1.text
      const posMatch = e.message.match(/position (\d+)/)
      const pos = posMatch ? parseInt(posMatch[1], 10) : null
      const context =
        pos != null
          ? text.substring(Math.max(0, pos - 200), Math.min(text.length, pos + 200))
          : null
      console.error('JSON parse failed:', {
        stop_reason: message1.stop_reason,
        usage: message1.usage,
        text_length: text.length,
        parse_error: e.message,
        error_position: pos,
        context_around_error: context,
        first_500: text.substring(0, 500),
        last_500: text.substring(Math.max(0, text.length - 500)),
      })
      const hint =
        (message1.stop_reason as string) === 'max_tokens'
          ? ' (respuesta truncada por max_tokens)'
          : ''
      throw new Error(`Error al parsear respuesta de Claude${hint}. Intenta de nuevo.`)
    }

    let tags = { all_tags: [] as string[] }
    try {
      tags = parseJson((message2.content[0] as { text: string }).text)
    } catch {
      console.error('Tags parse failed')
    }

    // ── Normalize href paths inside body text blocks ──────────────────────────
    // Claude's prompt includes link-rewrite rules but doesn't always apply
    // them correctly (e.g. /indexes/ pages mapped to /content/msci instead of
    // /content/ipc).  Running toAemPath over every href makes this deterministic.
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

    // ── Enrich body_blocks with real SharePoint items ────────────────────────
    // sharepoint_index is a 0-based position directly into items[].
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
    const finalFootnotes = footnotesFromXml.length > 0 ? footnotesFromXml : parsed.footnotes || []

    // ── Related resources: AEM path rewrite + cap at 3 ───────────────────────
    const allRelated = (parsed.related_resources || []).map((r) => ({
      ...r,
      original_url: r.url,
      aem_path: toAemPath(r.url),
    }))
    const relatedResources = allRelated.slice(0, 3)
    const relatedWarning =
      allRelated.length > 3
        ? `The document contained ${allRelated.length} related resources. Only the first 3 were included.`
        : null

    // Body hash for future reprocess diff detection
    const _body_hash = createHash('md5').update(bodySection).digest('hex')

    return NextResponse.json({
      ...parsed,
      related_resources: relatedResources,
      related_warning: relatedWarning,
      authors,
      tags,
      slug,
      final_url,
      footnotes: finalFootnotes,
      _body_hash,
    })
  } catch (err) {
    console.error('Parse error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
