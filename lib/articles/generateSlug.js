/**
 * generateSlug
 *
 * Slugger used by the /api/parse/docx pipeline to build both the
 * article slug (from the headline) and the author slug (from the
 * author name). Preserves the exact legacy behavior — notably, it
 * does NOT expand `&` into `-and-` and only trims whitespace, not
 * leading/trailing dashes. Keep this distinct from lib/utils/slugify
 * so we don't accidentally regress the URLs of already-published
 * articles.
 */
export function generateSlug(input) {
  if (!input) return ''
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}
