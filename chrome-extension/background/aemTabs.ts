/**
 * aemTabs
 *
 * Tab-discovery helpers for the service worker:
 *
 *   - getActiveAEMTab: returns the current tab only if it's already
 *     on the configured AEM Author host. Used by the "run in the
 *     active tab" handlers (publish, create page, check…).
 *
 *   - findEditorTabForPage: scans every window looking for an open
 *     editor.html tab matching a given slug. Needed by the key
 *     findings flow: the user is usually in Sites/Assets when they
 *     trigger the action, so the editor is in a different tab.
 *
 * Returns diagnostic info alongside the tab so the side panel can
 * show a useful message when nothing matches.
 */
import { isAemUrl } from './config.js'

export async function getActiveAEMTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!isAemUrl(tab?.url)) return null
  return tab
}

export async function findEditorTabForPage(slug) {
  const diag = { totalAemTabs: 0, totalEditorTabs: 0, urls: [], reason: '' }

  // Always query everything and filter manually. URL match patterns
  // in chrome.tabs.query are picky and have returned 0 results even
  // when the editor was clearly open.
  const allTabs = await chrome.tabs.query({})
  const aemTabs = allTabs.filter((t) => isAemUrl(t.url))
  const editorTabs = aemTabs.filter((t) => t.url.includes('/editor.html/'))

  diag.totalAemTabs = aemTabs.length
  diag.totalEditorTabs = editorTabs.length
  diag.urls = aemTabs.slice(0, 8).map((t) => t.url)

  if (!editorTabs.length) {
    diag.reason = aemTabs.length
      ? `no editor.html tab open (saw ${aemTabs.length} other AEM tab(s) — Sites/Assets view doesn't have Granite.author)`
      : 'no AEM tabs open at all'
    return { tab: null, diag }
  }

  // Permissive match: any editor.html tab whose URL contains the slug.
  const match =
    editorTabs.find((t) => t.url.includes('/' + slug + '.html')) ||
    editorTabs.find((t) => t.url.includes('/' + slug))

  if (!match) {
    diag.reason = `${editorTabs.length} editor.html tab(s) open, none matching slug "${slug}"`
    return { tab: null, diag }
  }

  return { tab: match, diag }
}
