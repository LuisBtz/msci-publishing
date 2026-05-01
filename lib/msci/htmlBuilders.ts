import { MSCI_STYLES } from './styleTokens'

export function inlineStyle(styleObj: Record<string, string>): string {
  return Object.entries(styleObj).map(([k, v]) => `${k}:${v}`).join(';')
}

export function wrapBodyHtml(html: string): string {
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

export function buildKeyFindingsHtml(bullets: string[]): string {
  const lis = (bullets || [])
    .map(b =>
      `<li style="margin-bottom:16px"><span style="${inlineStyle(MSCI_STYLES.bulletItem)}">${b}</span></li>`
    )
    .join('')
  return `<ul style="list-style-type:disc;padding-left:24px;margin:16px 0">${lis}</ul>`
}

export function buildFootnotesHtml(footnotes: Array<{ number: number; text: string }>): string {
  return (footnotes || [])
    .map(f => {
      const text = f.text.replace(/<a\s/gi, `<a style="${inlineStyle(MSCI_STYLES.link)}" `)
      return `<p><span style="${inlineStyle(MSCI_STYLES.footnote)}">${f.number}&nbsp;${text}</span></p>`
    })
    .join('')
}

export function buildCaptionHtml(caption: string): string {
  return `<p><span style="${inlineStyle(MSCI_STYLES.caption)}">${caption}</span></p>`
}
