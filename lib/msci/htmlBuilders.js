/**
 * MSCI rich HTML builders
 *
 * Converts in-app content (paragraphs, bullets, footnotes, captions) into
 * the exact inline-styled HTML that AEM's rich-text editor accepts when
 * the user pastes from the article editor. AEM strips classes on paste,
 * so every style must be inlined using the MSCI_STYLES tokens.
 *
 * Paired with the copy buttons in the ArticlePage content tab.
 */

import { MSCI_STYLES } from './styleTokens'

// Serialize a CSS-in-JS object into an inline `style="..."` string.
export function inlineStyle(styleObj) {
  return Object.entries(styleObj).map(([k, v]) => `${k}:${v}`).join(';')
}

// Wrap body HTML produced by the DOCX parser into MSCI-styled spans that
// survive an AEM RTE paste. Handles h2/h3 → styled paragraph, sup, links,
// and plain paragraphs.
export function wrapBodyHtml(html) {
  let out = html || ''
  out = out.replace(/<h2>([\s\S]*?)<\/h2>/gi, (_, inner) =>
    `<p><span style="${inlineStyle(MSCI_STYLES.headline2)}">${inner}</span></p>`
  )
  out = out.replace(/<h3>([\s\S]*?)<\/h3>/gi, (_, inner) =>
    `<p><span style="${inlineStyle(MSCI_STYLES.headline3)}">${inner}</span></p>`
  )
  out = out.replace(/<sup>([\s\S]*?)<\/sup>/gi, (_, inner) =>
    `<sup style="${inlineStyle(MSCI_STYLES.sup)}">${inner}</sup>`
  )
  out = out.replace(/<a\s/gi, `<a style="${inlineStyle(MSCI_STYLES.link)}" `)
  out = out.replace(/<p>([\s\S]*?)<\/p>/gi, (match, inner) => {
    if (
      inner.includes(inlineStyle(MSCI_STYLES.headline2)) ||
      inner.includes(inlineStyle(MSCI_STYLES.headline3))
    ) {
      return match
    }
    return `<p><span style="${inlineStyle(MSCI_STYLES.bodyArticle)}">${inner}</span></p>`
  })
  return out
}

// Build the Key Findings <ul> styled for AEM paste.
export function buildKeyFindingsHtml(bullets) {
  const lis = (bullets || [])
    .map(b =>
      `<li style="margin-bottom:16px"><span style="${inlineStyle(MSCI_STYLES.bulletItem)}">${b}</span></li>`
    )
    .join('')
  return `<ul style="list-style-type:disc;padding-left:24px;margin:16px 0">${lis}</ul>`
}

// Build the footnotes block (numbered lines with links preserved).
export function buildFootnotesHtml(footnotes) {
  return (footnotes || [])
    .map(f => {
      const text = f.text.replace(/<a\s/gi, `<a style="${inlineStyle(MSCI_STYLES.link)}" `)
      return `<p><span style="${inlineStyle(MSCI_STYLES.footnote)}">${f.number}&nbsp;${text}</span></p>`
    })
    .join('')
}

// Build a caption paragraph (used for exhibit captions).
export function buildCaptionHtml(caption) {
  return `<p><span style="${inlineStyle(MSCI_STYLES.caption)}">${caption}</span></p>`
}
