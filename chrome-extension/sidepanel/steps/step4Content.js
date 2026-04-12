/**
 * Step 4 — Content Blocks
 *
 * Populates the final wizard step: previews the article's bullet
 * list (key findings) and body blocks, and builds the payloads that
 * AEM's components expect.
 *
 * Key findings payload is intentionally quirky (crossed `</li></span>`
 * closings, single-quoted class attributes, specific textAsJson AST)
 * — it mirrors exactly what AEM's dialog produces on a manual Done.
 *
 * Body blocks payload flattens body_blocks + exhibit_paths into an
 * array that insertBodyContentInAEM can consume to dynamically create
 * containers and components via Sling POST.
 */
import { state } from '../state.js'
import { escHtml } from '../ui/escHtml.js'

export function populateStep4() {
  const a = state.selectedArticle
  document.getElementById('step4-title').textContent = a.headline || 'Untitled'

  const bullets = a.bullets || []
  const preview = document.getElementById('kf-preview')
  const btnInsert = document.getElementById('btn-insert-kf')
  const btnCopy = document.getElementById('btn-copy-kf')

  if (bullets.length === 0) {
    preview.innerHTML = '<p class="empty-state">No key findings for this article</p>'
    btnInsert.disabled = true
    btnCopy.disabled = true
  } else {
    preview.innerHTML =
      '<ul>' + bullets.map((b) => `<li>${escHtml(b)}</li>`).join('') + '</ul>'
    btnInsert.disabled = false
    btnCopy.disabled = false
  }

  document.getElementById('kf-log').classList.add('hidden')
  document.getElementById('kf-log').innerHTML = ''
  btnInsert.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 12l7-7 3 3-7 7H2v-3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 3.5l2-2 3 3-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    Insert into AEM
  `
  btnCopy.textContent = 'Copy HTML'

  // Populate body blocks preview
  populateBodyBlocksPreview(a)
}

function populateBodyBlocksPreview(article) {
  const container = document.getElementById('body-blocks-preview')
  const btnInsertBody = document.getElementById('btn-insert-body')
  const blocks = article.body_blocks || []

  if (blocks.length === 0) {
    container.innerHTML = '<p class="empty-state">No body blocks for this article</p>'
    btnInsertBody.disabled = true
    return
  }
  btnInsertBody.disabled = false

  let html = '<div class="body-blocks-list">'
  blocks.forEach((block, i) => {
    if (block.type === 'text') {
      const plain = block.html
        ? block.html.replace(/<[^>]+>/g, '').substring(0, 120)
        : '(empty)'
      html += `
        <div class="body-block-item body-block-text">
          <span class="body-block-badge text">T</span>
          <div class="body-block-content">
            <span class="body-block-type">Text Block ${i + 1}</span>
            <span class="body-block-excerpt">${escHtml(plain)}${plain.length >= 120 ? '…' : ''}</span>
          </div>
        </div>`
    } else if (block.type === 'exhibit') {
      const exhibitType = block.exhibit_type || block.sharepoint_data?.type || 'static'
      const badge = exhibitType === 'interactive' ? '⚡' : '🖼'
      html += `
        <div class="body-block-item body-block-exhibit">
          <span class="body-block-badge exhibit">${badge}</span>
          <div class="body-block-content">
            <span class="body-block-type">${exhibitType === 'interactive' ? 'Interactive' : 'Exhibit'} ${i + 1}</span>
            ${block.title ? `<span class="body-block-excerpt">${escHtml(block.title)}</span>` : ''}
            ${block.caption ? `<span class="body-block-caption">${escHtml(block.caption.substring(0, 80))}${block.caption.length > 80 ? '…' : ''}</span>` : ''}
          </div>
        </div>`
    }
  })
  html += '</div>'
  html += `<p class="body-blocks-count">${blocks.length} blocks total</p>`
  container.innerHTML = html

  // Reset log
  document.getElementById('body-log').classList.add('hidden')
  document.getElementById('body-log').innerHTML = ''
}

// Build the payload for a webmasters-aem richtexteditor "key findings"
// bullet list. We have to produce BOTH:
//
//   1. `html`       — goes into `text` and `derivedDom`. Editor reads this.
//   2. `textAsJson` — goes into `textAsJson`. Preview/published renderer
//                     reads this. If it's missing or stale the preview
//                     shows the heading but no bullets.
//
// Both shapes MUST match what AEM's dialog would produce on a manual
// Done, otherwise (a) the preview won't render bullets, and (b) pressing
// Done later will visibly re-shape them.
//
// Notable quirks copied verbatim from the reference:
//   - the SPAN uses single-quoted class attributes
//   - the closing tags come out as `</li></span>` (yes, crossed — AEM
//     literally stores it this way and its own renderer expects it)
//   - the `<ul>` carries no inline styles, no class
export function buildKeyFindingsPayload(bullets) {
  // Decode any HTML entities in the bullet so we have plain text to put
  // into the JSON AST. The text going into `html` is also plain (no tags)
  // so the sidepanel-side DOM decoder is fine.
  const plain = (bullets || [])
    .map((b) => {
      const tmp = document.createElement('div')
      tmp.innerHTML = String(b || '')
      return (tmp.textContent || '').trim()
    })
    .filter(Boolean)

  const SPAN_CLASS = 'ms-body-l-sm lg:ms-body-l-lg ms-font-regular'

  const lis = plain
    .map((t) => `<li><span class='${SPAN_CLASS}'>${t}</li></span>`)
    .join('')
  const html = `<ul>${lis}</ul>`

  const textAsJson = JSON.stringify({
    root: {
      children: [
        {
          tag: 'UL',
          className: '',
          tailwindStyles: '',
          typography: '',
          color: '',
          children: plain.map((t) => ({
            tag: 'LI',
            className: '',
            tailwindStyles: '',
            typography: '',
            color: '',
            children: [
              {
                tag: 'SPAN',
                className: SPAN_CLASS,
                tailwindStyles: '',
                typography: '',
                color: '',
                children: [{ tag: 'text', textContent: t }],
              },
            ],
          })),
        },
      ],
    },
  })

  return { html, textAsJson }
}

/**
 * Build the body blocks payload for insertBodyContentInAEM.
 *
 * Flattens article.body_blocks + exhibit_paths into a clean array where
 * each exhibit block carries its resolved filenames (desktop/mobile for
 * static, json for interactive) so the injected function can construct
 * the DAM paths without needing access to the full exhibit_paths object.
 */
export function buildBodyBlocksPayload(article) {
  const blocks = article.body_blocks || []
  const exhibitPaths = article.exhibit_paths || {}
  const items = exhibitPaths.items || []

  return blocks.map((block) => {
    if (block.type === 'text') {
      return { type: 'text', html: block.html || '' }
    }

    if (block.type === 'exhibit') {
      const idx = block.sharepoint_index ?? block.exhibit_index
      const exhibit = idx != null ? items[idx] : null
      const exhibitType = exhibit?.type || block.exhibit_type || block.sharepoint_data?.type || 'static'

      const payload = {
        type: 'exhibit',
        exhibitType,
        title: block.title || '',
        caption: block.caption || '',
      }

      if (exhibitType === 'static' && exhibit) {
        payload.desktopFilename = exhibit.desktop?.filename || ''
        payload.mobileFilename = exhibit.mobile?.filename || ''
      } else if (exhibitType === 'interactive' && exhibit) {
        payload.jsonFilename = exhibit.json?.filename || ''
      }

      return payload
    }

    return block
  })
}
