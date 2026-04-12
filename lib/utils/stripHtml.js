/**
 * stripHtml
 *
 * Browser-only helper that extracts plain text from an HTML string by
 * round-tripping it through a detached <div>. Used by the article editor
 * when the user copies a block as plain text and when building fallback
 * text/plain blobs for rich-copy operations.
 */
export function stripHtml(html) {
  const tmp = document.createElement('div')
  tmp.innerHTML = html || ''
  return tmp.textContent || tmp.innerText || ''
}
