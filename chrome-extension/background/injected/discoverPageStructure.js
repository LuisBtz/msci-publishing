/**
 * discoverPageStructure (INJECTED)
 *
 * Walks the full JCR tree of a blog-post page and returns a structured
 * map of every component: its sling:resourceType, path, parent chain,
 * and any content already present. This is used to understand the
 * template's container hierarchy (Theme Container v2 → Layout Container
 * → RTE / Image / Vega Embed) before building body-content injection.
 *
 * SELF-CONTAINED: serialized into the page — no imports / closures.
 */
export async function discoverPageStructure(slug) {
  const logs = []
  const log = (m) => logs.push({ type: 'log', message: m })
  const logErr = (m) => logs.push({ type: 'error', message: m })
  const logWarn = (m) => logs.push({ type: 'warn', message: m })

  console.groupCollapsed('[Discover] page structure for ' + slug)
  try {
    log('Obteniendo token CSRF…')
    const token = (await fetch('/libs/granite/csrf/token.json').then((r) => r.json())).token
    if (!token) throw new Error('No se pudo obtener el token CSRF')

    const parentPath = '/content/msci/us/en/research-and-insights/blog-post'
    const jcrContent = parentPath + '/' + slug + '/jcr:content'

    log('Leyendo árbol JCR completo…')
    const pageTree = await fetch(jcrContent + '.infinity.json', {
      headers: { 'CSRF-Token': token },
    }).then((r) => r.json())
    if (!pageTree) throw new Error('No se pudo leer la página')

    // Collect every component node with its full context
    const components = []
    const containers = []

    function walk(node, path, depth, parentType) {
      if (!node || typeof node !== 'object') return
      const resType = node['sling:resourceType'] || ''
      const nodeName = path.substring(path.lastIndexOf('/') + 1)

      if (resType) {
        const entry = {
          path,
          nodeName,
          depth,
          resourceType: resType,
          parentType: parentType || '(root)',
          text: typeof node.text === 'string' ? node.text.replace(/<[^>]+>/g, '').substring(0, 80) : '',
          textAsJson: typeof node.textAsJson === 'string' ? node.textAsJson.substring(0, 60) : '',
          fileReference: typeof node.fileReference === 'string' ? node.fileReference : '',
          isEmpty: !node.text && !node.fileReference && !node.textAsJson,
          properties: Object.keys(node).filter(
            (k) => !k.startsWith('jcr:') && !k.startsWith('sling:') && !k.startsWith('cq:') && !k.startsWith(':') && typeof node[k] !== 'object'
          ),
        }
        components.push(entry)

        // Track containers specifically
        if (resType.includes('container') || resType.includes('Container') || resType.includes('parsys') || resType.includes('responsivegrid')) {
          containers.push(entry)
        }
      }

      for (const [k, v] of Object.entries(node)) {
        if (k.startsWith('jcr:') || k.startsWith('sling:') || k.startsWith('cq:') || k.startsWith(':')) continue
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          walk(v, path + '/' + k, depth + 1, resType || parentType)
        }
      }
    }

    walk(pageTree, jcrContent, 0, '')

    // Build a readable tree view
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    log('COMPONENT TREE (' + components.length + ' components)')
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Group by unique resourceTypes
    const typeCount = {}
    for (const c of components) {
      typeCount[c.resourceType] = (typeCount[c.resourceType] || 0) + 1
    }

    log('\nRESOURCE TYPES:')
    for (const [type, count] of Object.entries(typeCount).sort((a, b) => b[1] - a[1])) {
      log('  ' + count + 'x  ' + type)
    }

    log('\nFULL TREE:')
    for (const c of components) {
      const indent = '  '.repeat(c.depth)
      const shortType = c.resourceType.split('/').pop()
      const content = c.text
        ? ' → "' + c.text + '"'
        : c.fileReference
          ? ' → [img] ' + c.fileReference
          : c.isEmpty
            ? ' (empty)'
            : ''
      log(indent + c.nodeName + ' [' + shortType + ']' + content)
    }

    // Log containers with their children
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    log('CONTAINERS (' + containers.length + ')')
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    for (const c of containers) {
      const children = components.filter(
        (comp) => comp.path.startsWith(c.path + '/') && comp.depth === c.depth + 1
      )
      log('\n' + c.nodeName + ' [' + c.resourceType + ']')
      log('  path: ' + c.path)
      log('  children: ' + children.length)
      for (const child of children) {
        const shortType = child.resourceType.split('/').pop()
        const content = child.text
          ? ' → "' + child.text + '"'
          : child.fileReference
            ? ' → [img]'
            : child.isEmpty
              ? ' (empty)'
              : ''
        log('    ' + child.nodeName + ' [' + shortType + ']' + content)
      }
    }

    // Also dump the full data to console for detailed inspection
    console.log('[Discover] All components:', components)
    console.log('[Discover] Containers:', containers)
    console.log('[Discover] Resource type counts:', typeCount)
    console.table(
      components.map((c) => ({
        depth: c.depth,
        nodeName: c.nodeName,
        resourceType: c.resourceType.split('/').pop(),
        text: c.text.substring(0, 40),
        fileReference: c.fileReference ? '✓' : '',
        empty: c.isEmpty ? '✓' : '',
        path: c.path.replace(jcrContent, '…'),
      }))
    )

    log('\n✅ Discovery completo — revisa la consola del navegador (F12) para datos detallados.')
    return { success: true, logs, components, containers, typeCount }
  } catch (err) {
    console.error('[Discover] fatal', err)
    logErr('Error: ' + err.message)
    return { success: false, logs, error: err.message }
  } finally {
    console.groupEnd()
  }
}
