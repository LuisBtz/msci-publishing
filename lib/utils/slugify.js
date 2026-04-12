/**
 * slugify
 *
 * Pure string → URL-safe slug converter used across the app:
 *   - article headline → Supabase slug
 *   - author name → content-fragment path segment
 *   - AEM tag value → AEM taxonomy slug
 *
 * Normalizes Unicode (strips accents), lowercases, replaces non
 * alphanumerics with dashes, and collapses repeated dashes.
 */
export function slugify(input) {
  if (!input) return ''
  return input
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, '-and-')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim()
}
