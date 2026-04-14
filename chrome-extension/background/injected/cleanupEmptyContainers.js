/**
 * cleanupEmptyContainers (INJECTED)
 *
 * After all content modules have been injected, this script walks
 * the page's JCR tree looking for Theme Container v2 nodes (or any
 * other component) that have no meaningful child content. Empty
 * containers are deleted via Sling POST so the published page
 * doesn't show blank sections.
 *
 * SELF-CONTAINED: serialized via chrome.scripting — ALL helper
 * functions must be defined INSIDE this function because Chrome
 * only serializes the target function, not sibling declarations.
 */
export async function cleanupEmptyContainers(slug) {
  const logs = []
  const log = (m) => logs.push({ type: 'log', message: m })
  const logErr = (m) => logs.push({ type: 'error', message: m })
  const logWarn = (m) => logs.push({ type: 'warn', message: m })

  /**
   * Recursively checks whether a container node has any meaningful
   * child content (text, images, content fragments, etc.).
   * A container is "empty" if it only has JCR metadata properties
   * and responsivegrid children that themselves are empty.
   */
  function checkContainerHasContent(node) {
    if (!node || typeof node !== 'object') return false

    for (const [key, value] of Object.entries(node)) {
      // Skip JCR/Sling metadata
      if (key.startsWith('jcr:') || key.startsWith(':') || key.startsWith('sling:')) continue
      if (key === 'cq:styleIds' || key === 'cq:responsive') continue

      if (typeof value === 'object' && value !== null) {
        const childType = value['sling:resourceType'] || ''

        // responsivegrid is a wrapper — check its children
        if (childType.includes('responsivegrid') || childType.includes('wcm/foundation/components/responsivegrid')) {
          if (checkContainerHasContent(value)) return true
          continue
        }

        // If there's a non-grid child component, container has content
        if (childType && !childType.includes('responsivegrid')) return true

        // Object with no resourceType — check deeper
        if (checkContainerHasContent(value)) return true
      }
    }

    return false
  }

  try {
    const parentPath = '/content/msci/us/en/research-and-insights/blog-post'
    const mainPath = `${parentPath}/${slug}/jcr:content/root/main`

    log('Fetching page structure...')
    const res = await fetch(`${mainPath}.3.json`, {
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

    // Identify container nodes under main
    const containerResourceTypes = [
      'webmasters-aem/components/themecontainerv2',
      'webmasters-aem/components/container',
    ]

    const emptyPaths = []

    for (const [nodeName, nodeData] of Object.entries(mainNode)) {
      if (!nodeData || typeof nodeData !== 'object') continue
      if (nodeName.startsWith('jcr:') || nodeName.startsWith(':') || nodeName === 'sling:resourceType') continue

      const resourceType = nodeData['sling:resourceType'] || ''
      const isContainer = containerResourceTypes.some((rt) => resourceType.includes(rt))
      if (!isContainer) continue

      // Check if this container has any meaningful child content
      const hasContent = checkContainerHasContent(nodeData)
      if (!hasContent) {
        emptyPaths.push({ name: nodeName, path: `${mainPath}/${nodeName}`, resourceType })
      }
    }

    if (emptyPaths.length === 0) {
      log('No empty containers found.')
      return { success: true, logs, deletedCount: 0, deletedPaths: [] }
    }

    log(`Found ${emptyPaths.length} empty container(s). Deleting...`)
    const deletedPaths = []

    for (const container of emptyPaths) {
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
          log(`  Deleted: ${container.name}`)
          deletedPaths.push(container.path)
        } else {
          logWarn(`  Failed to delete ${container.name}: HTTP ${delRes.status}`)
        }
      } catch (e) {
        logErr(`  Error deleting ${container.name}: ${e.message}`)
      }
    }

    log(`Cleanup complete: ${deletedPaths.length} container(s) removed.`)
    return { success: true, logs, deletedCount: deletedPaths.length, deletedPaths }
  } catch (err) {
    logErr('Fatal error: ' + err.message)
    return { success: false, logs, error: err.message }
  }
}
