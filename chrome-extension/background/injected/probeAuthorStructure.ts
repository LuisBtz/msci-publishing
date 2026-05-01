/**
 * probeAuthorStructure (INJECTED)
 *
 * Scans sibling blog-post pages to discover how authors are rendered
 * in the body section using Content Fragment components inside
 * Theme Container v2 with 2 columns.
 *
 * Expected structure (from manual observation):
 *   Theme Container v2 (parent, 1 col)
 *     └─ node0 (responsivegrid)
 *         └─ Theme Container v2 (2 cols)
 *             ├─ node0 (responsivegrid) → Content Fragment (author 1)
 *             └─ node1 (responsivegrid) → Content Fragment (author 2)
 *             └─ (optional) another Theme Container v2 (2 cols) for authors 3-4…
 *
 * This probe captures:
 *   - The full container hierarchy around Content Fragments
 *   - All properties on Content Fragment nodes (fragmentPath, etc.)
 *   - The numOfColumns setting on the parent container
 *   - How multiple author pairs are nested
 *
 * SELF-CONTAINED: serialized into the page — no imports / closures.
 */
export async function probeAuthorStructure(slug) {
  const logs = []
  const log = (m) => logs.push({ type: 'log', message: m })
  const logErr = (m) => logs.push({ type: 'error', message: m })
  const logWarn = (m) => logs.push({ type: 'warn', message: m })

  console.groupCollapsed('[ProbeAuthors] scanning siblings for author structure')
  try {
    log('Obteniendo token CSRF...')
    const token = (await fetch('/libs/granite/csrf/token.json').then((r) => r.json())).token
    if (!token) throw new Error('No se pudo obtener el token CSRF')

    const siblingBase = '/content/msci/us/en/research-and-insights/blog-post'

    // Results to collect
    const results = {
      contentFragmentNodes: [],   // every CF node found with full props
      authorContainers: [],       // container hierarchies that hold CFs
      twoColContainers: [],       // containers with numOfColumns=2
      bestExample: null,          // the clearest example with 2+ authors
    }

    log('Listando siblings...')
    const list = await fetch(siblingBase + '.1.json', {
      headers: { 'CSRF-Token': token },
    }).then((r) => r.json())

    const siblings = Object.keys(list)
      .filter((k) => !k.startsWith('jcr:') && !k.startsWith(':') && !k.startsWith('sling:') && !k.startsWith('cq:') && k !== slug && k !== 'rep:policy')
      .slice(0, 40)

    log('Encontrados ' + siblings.length + ' siblings para explorar')

    const CF_TYPE = 'webmasters-aem/components/contentfragment'
    const CONTAINER_TYPE = 'webmasters-aem/components/container/v2/container'
    let bestAuthorCount = 0

    for (const sib of siblings) {
      if (bestAuthorCount >= 4) break // found a great example

      let tree
      try {
        tree = await fetch(siblingBase + '/' + sib + '/jcr:content.infinity.json', {
          headers: { 'CSRF-Token': token },
        }).then((r) => r.json())
      } catch (e) {
        continue
      }
      if (!tree) continue

      // Collect all Content Fragment nodes and their ancestors
      const cfNodes = []
      const allContainers = []

      function walk(node, path, ancestors) {
        if (!node || typeof node !== 'object') return
        const resType = node['sling:resourceType'] || ''

        // Track containers
        if (resType === CONTAINER_TYPE) {
          allContainers.push({
            path,
            nodeName: path.split('/').pop(),
            numOfColumns: node.numOfColumns || node['numOfColumns'] || '1',
            properties: extractProps(node),
            childKeys: Object.keys(node).filter(
              (k) => !k.startsWith('jcr:') && !k.startsWith('sling:') && !k.startsWith('cq:') && !k.startsWith(':') && typeof node[k] === 'object'
            ),
          })
        }

        // Track Content Fragments
        if (resType.includes('contentfragment') || resType.includes('content-fragment') || resType.includes('ContentFragment')) {
          const props = extractProps(node)
          cfNodes.push({
            path,
            nodeName: path.split('/').pop(),
            resourceType: resType,
            properties: props,
            ancestors: [...ancestors],
            fullNode: node,
          })
        }

        const newAncestors = resType ? [...ancestors, { path, resourceType: resType, nodeName: path.split('/').pop() }] : ancestors

        for (const [k, v] of Object.entries(node)) {
          if (k.startsWith('jcr:') || k.startsWith('sling:') || k.startsWith('cq:') || k.startsWith(':')) continue
          if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            walk(v, path + '/' + k, newAncestors)
          }
        }
      }

      walk(tree, siblingBase + '/' + sib + '/jcr:content', [])

      if (cfNodes.length === 0) continue

      log('\n' + sib + ': ' + cfNodes.length + ' Content Fragment(s)')

      for (const cf of cfNodes) {
        results.contentFragmentNodes.push({
          sibling: sib,
          ...cf,
        })

        // Log key details
        const propKeys = Object.keys(cf.properties)
        const pathLike = propKeys.filter((k) =>
          typeof cf.properties[k] === 'string' &&
          cf.properties[k].includes('/content/')
        )
        log('  CF: ' + cf.nodeName)
        log('    resourceType: ' + cf.resourceType)
        log('    props: ' + propKeys.join(', '))
        for (const pk of pathLike) {
          log('    ' + pk + ' = ' + cf.properties[pk])
        }

        // Show ancestor chain
        const chain = cf.ancestors.map((a) => {
          const shortType = a.resourceType.split('/').pop()
          return a.nodeName + '[' + shortType + ']'
        }).join(' → ')
        log('    chain: ' + chain + ' → ' + cf.nodeName)
      }

      // Find 2-column containers
      const twoCols = allContainers.filter((c) => String(c.numOfColumns) === '2')
      if (twoCols.length > 0) {
        log('  2-col containers: ' + twoCols.length)
        for (const tc of twoCols) {
          log('    ' + tc.nodeName + ' children: ' + tc.childKeys.join(', '))
          results.twoColContainers.push({ sibling: sib, ...tc })
        }
      }

      // Check if this is a good author example
      // Look for CFs that are inside 2-col containers (author pattern)
      const authorCFs = cfNodes.filter((cf) => {
        return cf.ancestors.some((a) => {
          const matching = allContainers.find((c) => c.path === a.path && String(c.numOfColumns) === '2')
          return !!matching
        })
      })

      if (authorCFs.length > bestAuthorCount) {
        bestAuthorCount = authorCFs.length

        // Build the full container hierarchy for this example
        const exampleTree = await fetch(
          siblingBase + '/' + sib + '/jcr:content.infinity.json',
          { headers: { 'CSRF-Token': token } }
        ).then((r) => r.json())

        // Find the section that contains the CFs
        let authorSectionPath = null
        if (authorCFs.length > 0) {
          // Go up from the first CF to find the outermost container
          const firstCF = authorCFs[0]
          // Find the container that has numOfColumns=2 in ancestors
          for (const ancestor of firstCF.ancestors) {
            const container = allContainers.find((c) => c.path === ancestor.path)
            if (container && String(container.numOfColumns) === '2') {
              // The author section is the parent of this 2-col container
              authorSectionPath = container.path.substring(0, container.path.lastIndexOf('/'))
              break
            }
          }
        }

        results.bestExample = {
          sibling: sib,
          authorCount: authorCFs.length,
          contentFragments: authorCFs.map((cf) => ({
            path: cf.path,
            nodeName: cf.nodeName,
            properties: cf.properties,
            ancestorChain: cf.ancestors.map((a) => ({
              nodeName: a.nodeName,
              resourceType: a.resourceType,
            })),
          })),
          twoColContainers: twoCols.map((tc) => ({
            path: tc.path,
            nodeName: tc.nodeName,
            properties: tc.properties,
            childKeys: tc.childKeys,
          })),
          authorSectionPath,
        }

        // Deep-capture the author section subtree for exact replication
        if (authorSectionPath) {
          const relPath = authorSectionPath.replace(siblingBase + '/' + sib + '/jcr:content', '')
          const parts = relPath.split('/').filter(Boolean)
          let subtree = exampleTree
          for (const p of parts) {
            subtree = subtree && subtree[p]
          }
          if (subtree) {
            results.bestExample.authorSectionTree = subtree
            console.log('[ProbeAuthors] author section subtree:', JSON.stringify(subtree, null, 2))
          }
        }
      }
    }

    // ── Summary Report ────────────────────────────────────────────────
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    log('RESUMEN DE EXPLORACIÓN')
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    log('\nTotal Content Fragments encontrados: ' + results.contentFragmentNodes.length)
    log('Contenedores de 2 columnas: ' + results.twoColContainers.length)

    // Unique resourceTypes for CFs
    const cfTypes = [...new Set(results.contentFragmentNodes.map((cf) => cf.resourceType))]
    log('\nResourceTypes de Content Fragment:')
    cfTypes.forEach((t) => log('  • ' + t))

    // Unique property names across all CFs
    const allPropNames = new Set()
    results.contentFragmentNodes.forEach((cf) => {
      Object.keys(cf.properties).forEach((k) => allPropNames.add(k))
    })
    log('\nPropiedades encontradas en CFs:')
    ;[...allPropNames].sort().forEach((k) => log('  • ' + k))

    // Path-like properties (the author reference)
    log('\nPropiedades con paths de contenido:')
    results.contentFragmentNodes.forEach((cf) => {
      Object.entries(cf.properties).forEach(([k, v]) => {
        if (typeof v === 'string' && v.includes('/content/')) {
          log('  ' + cf.sibling + '/' + cf.nodeName + '.' + k + ' = ' + v)
        }
      })
    })

    if (results.bestExample) {
      log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      log('MEJOR EJEMPLO: ' + results.bestExample.sibling + ' (' + results.bestExample.authorCount + ' autores)')
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      log('\nAuthor section path: ' + (results.bestExample.authorSectionPath || '(not found)'))

      log('\nContent Fragments:')
      results.bestExample.contentFragments.forEach((cf, i) => {
        log('\n  Author ' + (i + 1) + ':')
        log('    path: ' + cf.path)
        log('    nodeName: ' + cf.nodeName)
        log('    properties:')
        Object.entries(cf.properties).forEach(([k, v]) => {
          const val = typeof v === 'string' && v.length > 80 ? v.substring(0, 80) + '...' : v
          log('      ' + k + ' = ' + JSON.stringify(val))
        })
        log('    ancestor chain:')
        cf.ancestorChain.forEach((a) => {
          log('      ' + a.nodeName + ' [' + a.resourceType.split('/').pop() + ']')
        })
      })

      log('\n2-column containers in this example:')
      results.bestExample.twoColContainers.forEach((tc) => {
        log('  ' + tc.nodeName + ':')
        log('    path: ' + tc.path)
        log('    children: ' + tc.childKeys.join(', '))
        log('    properties:')
        Object.entries(tc.properties).forEach(([k, v]) => {
          if (k !== 'jcr:primaryType') log('      ' + k + ' = ' + JSON.stringify(v))
        })
      })
    } else {
      logWarn('\nNo se encontró un ejemplo claro de autores en Content Fragments.')
    }

    // Console dumps for detailed inspection
    console.log('[ProbeAuthors] All CF nodes:', results.contentFragmentNodes)
    console.log('[ProbeAuthors] All 2-col containers:', results.twoColContainers)
    console.log('[ProbeAuthors] Best example:', results.bestExample)

    log('\n✅ Probe completo — revisa la consola (F12) para datos detallados.')
    return { success: true, logs, results }
  } catch (err) {
    console.error('[ProbeAuthors] fatal', err)
    logErr('Error: ' + err.message)
    return { success: false, logs, error: err.message }
  } finally {
    console.groupEnd()
  }

  function extractProps(node) {
    const props = {}
    for (const [k, v] of Object.entries(node)) {
      if (typeof v !== 'object' || v === null) {
        props[k] = v
      }
    }
    return props
  }
}
