/**
 * Preview HTML inline-style strings
 *
 * When the TabPreview needs to render raw HTML from a body block via
 * dangerouslySetInnerHTML, it cannot rely on React-style objects. These
 * pre-baked CSS strings mirror the MSCI design tokens and are used to
 * rewrite `<h2>/<h3>/<p>/<a>/<sup>` into styled versions before
 * injection. Keeping them in one place avoids repeating the token
 * values across the preview renderer.
 */
import { t } from '@/lib/msci/styleTokens'

export const styleH2InBody = `font-family:${t.font};font-size:42px;line-height:50.4px;font-weight:600;letter-spacing:-2.1px;color:${t.black};margin:48px 0 16px 0;`
export const styleH3InBody = `font-family:${t.font};font-size:32px;line-height:41.6px;font-weight:600;letter-spacing:-1.28px;color:${t.black};margin:40px 0 16px 0;`
export const stylePInBody = `font-family:${t.font};font-size:20px;line-height:32px;font-weight:400;letter-spacing:-0.4px;color:${t.black};margin:0 0 16px 0;`
export const styleAInBody = `color:${t.brandblue700};text-decoration:underline;`
export const styleSupBody = `font-size:15px;letter-spacing:-0.4px;`

/**
 * Rewrite the body-block HTML from the DOCX parser into inline-styled
 * HTML ready to drop into the preview.
 */
export function decorateBodyHtml(html) {
  return (html || '')
    .replace(/<h2>/g, `<h2 style="${styleH2InBody}">`)
    .replace(/<h3>/g, `<h3 style="${styleH3InBody}">`)
    .replace(/<p>/g, `<p style="${stylePInBody}">`)
    .replace(/<a /g, `<a style="${styleAInBody}" `)
    .replace(/<sup>/g, `<sup style="${styleSupBody}">`)
}
