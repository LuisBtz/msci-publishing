/**
 * Claude prompts for /api/parse/docx
 *
 * Two builder functions that produce the exact user-content strings
 * sent to Claude during the two-call parse pipeline:
 *
 *   - buildExtractionPrompt: main structured-extraction prompt with
 *     META / BODY / END slices + SharePoint exhibits context +
 *     hyperlinks context.
 *   - buildTagsPrompt: second call that extracts only the checked
 *     tags from the intake template's tags section.
 *
 * Keeping these strings isolated makes it trivial to diff prompt
 * changes and lets the route module stay a thin orchestrator.
 */

export function buildExhibitsContext(exhibitsSummary) {
  if (!exhibitsSummary?.summary?.length) {
    return '\nNo exhibits found in SharePoint for this project.'
  }
  return (
    '\nEXHIBITS AVAILABLE IN SHAREPOINT (ordered by filename suffix — position in list = order in blog post):\n' +
    exhibitsSummary.summary
      .map((e, i) =>
        e.type === 'static'
          ? `Index ${i}: [STATIC] base_name: "${e.base_name}" | desktop: "${e.desktop_filename}"`
          : `Index ${i}: [INTERACTIVE] base_name: "${e.base_name}" | json: "${e.json_filename}"`
      )
      .join('\n')
  )
}

export function buildHyperlinksContext(hyperlinks) {
  if (!hyperlinks?.length) return ''
  return (
    '\nHYPERLINKS EXTRACTED FROM DOCUMENT (use these exact URLs — do not truncate or reconstruct):\n' +
    hyperlinks.map((l, i) => `${i + 1}. text: "${l.text}" | url: "${l.url}"`).join('\n')
  )
}

export function buildExtractionPrompt({
  metaSection,
  bodySection,
  endSection,
  exhibitsContext,
  hyperlinksContext,
}) {
  return `Extract structured data from this MSCI Research intake document. Return ONLY valid JSON, no markdown, no backticks.

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
}

export function buildTagsPrompt(tagsText) {
  return `Extract checked tags from this MSCI document tags section. Return ONLY valid JSON.

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
}
