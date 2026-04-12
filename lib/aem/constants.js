/**
 * AEM constants
 *
 * Single source of truth for the AEM Author host and the canonical content
 * paths used when building publish scripts, mapping URLs, and validating
 * resources. Keeping them here avoids drift between the Next.js app and the
 * Chrome extension.
 */

// AEM Author instance hosting MSCI.com authoring.
export const AEM_HOST = 'https://author-p125318-e1369672.adobeaemcloud.com'

// Public deployment of this publishing app (used by the Chrome extension
// to build cross-links back into the editor UI).
export const APP_HOST = 'https://msci-publishing.vercel.app'

// Canonical AEM content roots.
export const MSCI_CONTENT_ROOT = '/content/msci/us/en'
export const IPC_INDEXES_ROOT = '/content/ipc/us/en/indexes'

// DAM roots for blog-post assets (banners + exhibits).
export const DAM_BLOG_POST_ROOT = '/content/dam/web/msci-com/research-and-insights/blog-post'
export const DAM_CONTRIBUTOR_ROOT = '/content/dam/web/msci-com/research-and-insights/contributor'

// Assets API base for creating folders + uploads under blog-post.
export const ASSETS_BLOG_POST_API = '/api/assets/web/msci-com/research-and-insights/blog-post'

// Parent path under which new research/blog pages are created.
export const SITES_BLOG_POST_PARENT = '/content/msci/us/en/research-and-insights/blog-post'

// AEM page template for new research pages.
export const RESEARCH_PAGE_TEMPLATE = '/conf/webmasters-aem/settings/wcm/templates/research-page2'

// SharePoint download URLs expire after ~1 hour.
export const URL_LIFETIME_MS = 60 * 60 * 1000
