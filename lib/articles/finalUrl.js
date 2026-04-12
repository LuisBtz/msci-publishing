/**
 * buildArticleFinalUrl
 *
 * Maps an article type + slug to its canonical msci.com URL. Used by
 * /api/parse/docx so the dashboard can show the end-state URL right
 * after creation. Falls back to the blog-post prefix for unknown
 * types so a missing type never blocks the flow.
 */
const URL_PREFIXES = {
  'blog-post': '/research-and-insights/blog-post/',
  paper: '/research-and-insights/paper/',
  'quick-take': '/research-and-insights/quick-take/',
  podcast: '/research-and-insights/podcast/',
}

export function buildArticleFinalUrl(type, slug) {
  const prefix = URL_PREFIXES[type] || URL_PREFIXES['blog-post']
  return `https://www.msci.com${prefix}${slug}`
}
