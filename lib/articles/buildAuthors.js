/**
 * buildAuthors
 *
 * Takes the minimal { name } array Claude returns and enriches each
 * author with a slug, the AEM content-fragment path, and the public
 * contributor URL. `found: null` is set so the downstream
 * /api/fetch-meta check can populate it.
 */
import { generateSlug } from './generateSlug'

const CONTRIBUTOR_CF_ROOT = '/content/dam/web/msci-com/research-and-insights/contributor'
const CONTRIBUTOR_URL_ROOT = '/research-and-insights/contributor'

export function buildAuthors(rawAuthors) {
  return (rawAuthors || []).map((a) => {
    const slug = generateSlug(a.name)
    return {
      name: a.name,
      slug,
      content_fragment_path: `${CONTRIBUTOR_CF_ROOT}/${slug}/${slug}`,
      contributor_url: `${CONTRIBUTOR_URL_ROOT}/${slug}`,
      found: null,
    }
  })
}
