/**
 * escHtml
 *
 * Minimal HTML-entity escaper for interpolating untrusted strings into
 * innerHTML templates. Used by the Chrome side panel when rendering
 * Supabase-backed article cards — we can't rely on React there.
 */
export function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
