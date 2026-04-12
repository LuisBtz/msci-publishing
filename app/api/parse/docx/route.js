/**
 * POST /api/parse/docx
 *
 * Orchestrates the .docx → structured article pipeline:
 *   1. Read the uploaded .docx buffer (+ optional SharePoint exhibits payload)
 *   2. Extract raw text, XML, footnotes, hyperlinks, tags section
 *   3. Ask Claude for the structured fields (two calls: body + tags)
 *   4. Enrich body_blocks with matching SharePoint items
 *   5. Generate slug, final URL, author content-fragment paths
 *   6. Apply AEM path rules to related resources (capped at 3)
 *
 * All low-level extraction, prompts and helpers live in
 * lib/parse/docx and lib/articles — this file is the thin orchestrator.
 */
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

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

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
    const hyperlinksFromDocx = await extractHyperlinksFromDocx(buffer)

    const metaSection = extractMetaSection(docText)
    const bodySection = extractBodySection(docText)
    const endSection = extractEndSection(docText)

    const exhibitsContext = buildExhibitsContext(exhibitsSummary)
    const hyperlinksContext = buildHyperlinksContext(hyperlinksFromDocx)

    // ── Call 1: structured extraction ─────────────────────────────────────────
    const message1 = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 6000,
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

    let parsed
    try {
      parsed = parseJson(message1.content[0].text)
    } catch {
      console.error('JSON parse failed:', message1.content[0].text.substring(0, 500))
      throw new Error('Error al parsear respuesta de Claude. Intenta de nuevo.')
    }

    let tags = { all_tags: [] }
    try {
      tags = parseJson(message2.content[0].text)
    } catch {
      console.error('Tags parse failed')
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
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
