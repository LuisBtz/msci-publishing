/**
 * cleanupEmptyContainers (INJECTED)
 *
 * After all content modules have been injected, this script walks the
 * page's entire JCR tree (root/main + descendants) and deletes any
 * component that has no meaningful content. Spacer components are
 * always preserved since they are intentional margin injectors.
 *
 * Algorithm:
 *   1. Fetch the full JCR tree under root/main with deep traversal.
 *   2. Walk every node, classify each child as:
 *        - metadata (skip)
 *        - spacer (keep)
 *        - wrapper (responsivegrid — has content iff any descendant has content)
 *        - container (themecontainerv2, container — same rule)
 *        - leaf component (text, image, cf, etc.) — has content iff any
 *          non-metadata property is truthy OR has child nodes with content
 *   3. Collect every node that is NOT a spacer and is empty.
 *   4. Delete deepest paths first so we don't delete a parent before its
 *      empty children (each delete shortens siblings only).
 *
 * SELF-CONTAINED: serialized via chrome.scripting — ALL helpers must
 * be defined INSIDE this function.
 */
export async function cleanupEmptyContainers(slug) {
  const logs = []
  const log = (m) => logs.push({ type: 'log', message: m })
  const logErr = (m) => logs.push({ type: 'error', message: m })
  const logWarn = (m) => logs.push({ type: 'warn', message: m })

  const SPACER_MARKERS = ['spacer']
  const WRAPPER_MARKERS = ['responsivegrid', 'wcm/foundation/components/responsivegrid']
  // Components whose `id` property protects them and ALL their descendants
  // from cleanup, even if empty. Set on the parent component in AEM.
  const PROTECTED_IDS = ['cta-component', 'footnotes']
  // Content-bearing property names (for leaf components)
  const CONTENT_PROPS = [
    'text',
    'textIsRich',
    'fileReference',
    'fragmentPath',
    'contentFragmentPath',
    'profilePath',
    'linkURL',
    'ctaLink',
    'ctaLabel',
    'title',
    'heading',
    'description',
    'jcr:title',
    'jcr:description',
    'src',
    'textAsJson',
    'derivedDom',
  ]

  function isMetadataKey(key) {
    return (
      key.startsWith('jcr:') ||
      key.startsWith('sling:') ||
      key.startsWith(':') ||
      key === 'cq:styleIds' ||
      key === 'cq:responsive' ||
      key === 'cq:panelTitle'
    )
  }

  function isSpacer(resourceType) {
    if (!resourceType) return false
    const rt = resourceType.toLowerCase()
    return SPACER_MARKERS.some((m) => rt.includes(m))
  }

  function isWrapper(resourceType) {
    if (!resourceType) return false
    const rt = resourceType.toLowerCase()
    return WRAPPER_MARKERS.some((m) => rt.includes(m))
  }

  function isProtected(node) {
    if (!node || typeof node !== 'object') return false
    const id = typeof node.id === 'string' ? node.id.trim() : ''
    return id !== '' && PROTECTED_IDS.includes(id)
  }

  /**
   * Checks whether a node has any meaningful content. A node has
   * content if:
   *   - any content property has a non-empty value, OR
   *   - any child (non-metadata) node itself has content
   */
  function hasContent(node) {
    if (!node || typeof node !== 'object') return false

    // Property-based content (leaf components)
    for (const prop of CONTENT_PROPS) {
      const v = node[prop]
      if (v === undefined || v === null) continue
      if (typeof v === 'string' && v.trim() === '') continue
      if (Array.isArray(v) && v.length === 0) continue
      if (typeof v === 'object' && Object.keys(v).length === 0) continue
      return true
    }

    // Recurse into child nodes
    for (const [key, value] of Object.entries(node)) {
      if (isMetadataKey(key)) continue
      if (typeof value !== 'object' || value === null) continue

      const childRT = value['sling:resourceType'] || ''

      // A spacer child counts as content — it's intentional
      if (isSpacer(childRT)) return true

      // A protected subtree (cta-component, footnotes) always counts as
      // content so its ancestor wrappers are never deleted.
      if (isProtected(value)) return true

      // Wrappers & containers — dive in
      if (hasContent(value)) return true
    }

    return false
  }

  /**
   * Recursively walks the tree collecting every empty, non-spacer,
   * non-wrapper component path. Wrappers (responsivegrid) are kept
   * because removing them breaks the layout — instead we remove
   * their empty content descendants.
   */
  function collectEmpty(node, basePath, found, depth) {
    if (!node || typeof node !== 'object') return

    for (const [key, value] of Object.entries(node)) {
      if (isMetadataKey(key)) continue
      if (typeof value !== 'object' || value === null) continue

      const childPath = `${basePath}/${key}`
      const childRT = value['sling:resourceType'] || ''

      // Protected subtree (e.g. cta-component, footnotes): preserve the
      // node AND every descendant verbatim — do not recurse, do not mark
      // anything inside as empty.
      if (isProtected(value)) continue

      // Always recurse first to gather deeper empties
      if (childRT) {
        collectEmpty(value, childPath, found, depth + 1)
      }

      // Skip spacers
      if (isSpacer(childRT)) continue

      // Wrappers (responsivegrid): only delete if fully empty AND not root
      if (isWrapper(childRT)) {
        if (!hasContent(value) && depth > 0) {
          found.push({ path: childPath, name: key, rt: childRT, depth })
        }
        continue
      }

      // Any other component with a resourceType — check emptiness
      if (childRT && !hasContent(value)) {
        found.push({ path: childPath, name: key, rt: childRT, depth })
      }
    }
  }

  try {
    const parentPath = '/content/msci/us/en/research-and-insights/blog-post'
    const mainPath = `${parentPath}/${slug}/jcr:content/root/main`

    log('Fetching page structure...')
    // Depth 10 is aggressive but necessary to capture nested containers
    const res = await fetch(`${mainPath}.10.json`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      logErr(`Could not read page structure: HTTP ${res.status}`)
      return { success: false, logs, error: `HTTP ${res.status}` }
    }
    const mainNode = await res.json()

    log('Fetching CSRF token...')
    const token = (await fetch('/libs/granite/csrf/token.json').then((r) => r.json())).token
    if (!token) throw new Error('Could not get CSRF token')

    // Diagnostic: list all top-level components
    const topLevel = Object.entries(mainNode)
      .filter(([k, v]) => !isMetadataKey(k) && v && typeof v === 'object')
      .map(([k, v]) => ({ name: k, rt: v['sling:resourceType'] || '(no type)' }))
    log(`Top-level components: ${topLevel.length}`)
    for (const c of topLevel) log(`  · ${c.name} — ${c.rt}`)

    // Collect empties
    const found = []
    collectEmpty(mainNode, mainPath, found, 0)

    if (found.length === 0) {
      log('No empty components found.')
      return { success: true, logs, deletedCount: 0, deletedPaths: [] }
    }

    // Sort deepest first so we delete children before parents
    found.sort((a, b) => b.depth - a.depth)

    log(`Found ${found.length} empty component(s):`)
    for (const f of found) log(`  · [depth ${f.depth}] ${f.name} (${f.rt})`)

    const deletedPaths = []
    for (const container of found) {
      try {
        const delRes = await fetch(container.path, {
          method: 'POST',
          headers: {
            'CSRF-Token': token,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: ':operation=delete',
        })
        if (delRes.ok) {
          log(`  ✓ Deleted: ${container.name}`)
          deletedPaths.push(container.path)
        } else {
          logWarn(`  ✗ Failed to delete ${container.name}: HTTP ${delRes.status}`)
        }
      } catch (e) {
        logErr(`  ✗ Error deleting ${container.name}: ${e.message}`)
      }
    }

    log(`Cleanup complete: ${deletedPaths.length} component(s) removed.`)
    return { success: true, logs, deletedCount: deletedPaths.length, deletedPaths }
  } catch (err) {
    logErr('Fatal error: ' + err.message)
    return { success: false, logs, error: err.message }
  }
}
