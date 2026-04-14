/**
 * probeFootnotesStructure (INJECTED)
 *
 * Explores the last Theme Container v2 in sibling blog-post pages
 * to discover how footnotes are structured. The expected pattern is:
 *   Last Theme Container v2
 *     └─ node0 (responsivegrid)
 *         ├─ ... (spacer component)
 *         └─ richtexteditor (footnotes RTE)
 *
 * This probe captures:
 *   - All children of the last Theme Container v2
 *   - The spacer component and its properties
 *   - The RTE below the spacer (empty or with footnotes)
 *   - Full property dump of footnote RTEs from siblings that have them
 *
 * SELF-CONTAINED: serialized into the page — no imports / closures.
 */
export async function probeFootnotesStructure(slug) {
  const logs = []
  const log = (m) => logs.push({ type: 'log', message: m })
  const logErr = (m) => logs.push({ type: 'error', message: m })
  const logWarn = (m) => logs.push({ type: 'warn', message: m })

  console.groupCollapsed('[ProbeFootnotes] scanning for footnote structure')
  try {
    log('Obteniendo token CSRF...')
    const token = (await fetch('/libs/granite/csrf/token.json').then((r) => r.json())).token
    if (!token) throw new Error('No se pudo obtener el token CSRF')

    const siblingBase = '/content/msci/us/en/research-and-insights/blog-post'
    const CONTAINER_TYPE = 'webmasters-aem/components/container/v2/container'
    const RTE_TYPE = 'webmasters-aem/components/richtexteditor'
    const SPACER_TYPE = 'webmasters-aem/components/spacer'

    const results = {
      currentPage: null,
      siblingExamples: [],
      bestExample: null,
    }

    // ── Helper: extract scalar properties from a node ──────────────
    function extractProps(node) {
      const props = {}
      for (const [k, v] of Object.entries(node)) {
        if (typeof v !== 'object' || v === null) {
          props[k] = v
        }
      }
      return props
    }

    // ── Helper: get child keys (skip jcr/sling/cq metadata) ───────
    function childKeys(node) {
      return Object.keys(node).filter(
        (k) => !k.startsWith('jcr:') && !k.startsWith('sling:') &&
               !k.startsWith('cq:') && !k.startsWith(':') &&
               typeof node[k] === 'object' && node[k] !== null
      )
    }

    // ── Helper: find all Theme Container v2 nodes in tree ──────────
    function findContainers(node, path) {
      const containers = []
      if (!node || typeof node !== 'object') return containers
      if ((node['sling:resourceType'] || '') === CONTAINER_TYPE) {
        containers.push({ path, node })
      }
      for (const [k, v] of Object.entries(node)) {
        if (k.startsWith('jcr:') || k.startsWith('sling:') || k.startsWith('cq:') || k.startsWith(':')) continue
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          containers.push(...findContainers(v, path + '/' + k))
        }
      }
      return containers
    }

    // ── Helper: analyze a container's last responsivegrid ──────────
    function analyzeLastContainer(container, containerPath) {
      const kids = childKeys(container)
      const analysis = {
        containerPath,
        containerProps: extractProps(container),
        childCount: kids.length,
        children: [],
        spacerFound: false,
        rteAfterSpacer: null,
        allRTEs: [],
        lastRTE: null,
      }

      // Walk the first responsivegrid (node0) inside the container
      const gridKey = kids.find((k) => k.startsWith('node') || k === 'responsivegrid' || k === 'container')
      if (!gridKey) {
        // Maybe children are directly in the container
        for (const k of kids) {
          const child = container[k]
          const resType = child['sling:resourceType'] || ''
          analysis.children.push({
            name: k,
            resourceType: resType,
            props: extractProps(child),
          })
        }
      } else {
        const grid = container[gridKey]
        const gridKids = childKeys(grid)
        let spacerSeen = false

        for (const k of gridKids) {
          const child = grid[k]
          const resType = child['sling:resourceType'] || ''
          const info = {
            name: k,
            resourceType: resType,
            props: extractProps(child),
          }
          analysis.children.push(info)

          if (resType.includes('spacer')) {
            analysis.spacerFound = true
            spacerSeen = true
          }

          if (resType === RTE_TYPE) {
            analysis.allRTEs.push({
              name: k,
              path: containerPath + '/' + gridKey + '/' + k,
              props: extractProps(child),
              text: typeof child.text === 'string' ? child.text : '',
              textAsJson: child.textAsJson || null,
              derivedDom: child.derivedDom || null,
              textIsRich: child.textIsRich || null,
            })
            analysis.lastRTE = analysis.allRTEs[analysis.allRTEs.length - 1]

            if (spacerSeen) {
              analysis.rteAfterSpacer = analysis.allRTEs[analysis.allRTEs.length - 1]
            }
          }
        }
      }

      return analysis
    }

    // ── Step 1: Analyze current page ─────────────────────────────
    log('\n━━ Página actual: ' + slug + ' ━━')
    try {
      const jcrContent = siblingBase + '/' + slug + '/jcr:content'
      const pageTree = await fetch(jcrContent + '.infinity.json', {
        headers: { 'CSRF-Token': token },
      }).then((r) => r.json())

      const containers = findContainers(pageTree, jcrContent)
      log('Theme Container v2 encontrados: ' + containers.length)

      if (containers.length > 0) {
        // Get the LAST top-level container (footnotes are typically at the bottom)
        const lastContainer = containers[containers.length - 1]
        log('Ultimo container: ' + lastContainer.path)

        const analysis = analyzeLastContainer(lastContainer.node, lastContainer.path)
        results.currentPage = analysis

        log('Hijos del ultimo container:')
        for (const child of analysis.children) {
          const shortType = child.resourceType.split('/').pop()
          log('  ' + child.name + ' [' + shortType + ']')
        }

        if (analysis.spacerFound) {
          log('Spacer encontrado.')
        } else {
          logWarn('No se encontro spacer en el ultimo container.')
        }

        if (analysis.rteAfterSpacer) {
          log('RTE despues del spacer: ' + analysis.rteAfterSpacer.name)
          log('  texto: ' + (analysis.rteAfterSpacer.text ? analysis.rteAfterSpacer.text.substring(0, 100) + '...' : '(vacio)'))
        } else if (analysis.lastRTE) {
          log('Ultimo RTE en container: ' + analysis.lastRTE.name)
          log('  texto: ' + (analysis.lastRTE.text ? analysis.lastRTE.text.substring(0, 100) + '...' : '(vacio)'))
        } else {
          logWarn('No se encontro ningun RTE en el ultimo container.')
        }

        // Also log ALL containers for context
        log('\nTodos los containers (de primero a ultimo):')
        for (let i = 0; i < containers.length; i++) {
          const c = containers[i]
          const props = extractProps(c.node)
          const shortPath = c.path.replace(jcrContent + '/', '')
          log('  [' + i + '] ' + shortPath)
          if (props.numOfColumns) log('      cols: ' + props.numOfColumns)
        }
      }
    } catch (e) {
      logErr('Error leyendo pagina actual: ' + e.message)
    }

    // ── Step 2: Scan siblings for footnote examples ──────────────
    log('\n━━ Escaneando siblings para ejemplos de footnotes ━━')
    const list = await fetch(siblingBase + '.1.json', {
      headers: { 'CSRF-Token': token },
    }).then((r) => r.json())

    const siblings = Object.keys(list)
      .filter((k) => !k.startsWith('jcr:') && !k.startsWith(':') && !k.startsWith('sling:') && !k.startsWith('cq:') && k !== slug && k !== 'rep:policy')
      .slice(0, 40)

    log(siblings.length + ' siblings a escanear')

    let bestFootnoteLength = 0

    for (const sib of siblings) {
      if (results.siblingExamples.length >= 5) break // enough examples

      let tree
      try {
        tree = await fetch(siblingBase + '/' + sib + '/jcr:content.infinity.json', {
          headers: { 'CSRF-Token': token },
        }).then((r) => r.json())
      } catch (e) { continue }
      if (!tree) continue

      const containers = findContainers(tree, siblingBase + '/' + sib + '/jcr:content')
      if (containers.length === 0) continue

      const lastContainer = containers[containers.length - 1]
      const analysis = analyzeLastContainer(lastContainer.node, lastContainer.path)

      // Look for any non-empty RTE in the last container (likely footnotes)
      const footnoteRTE = analysis.rteAfterSpacer || analysis.lastRTE
      if (!footnoteRTE) continue

      const text = footnoteRTE.text || ''

      if (text.length > 0) {
        log('\nEjemplo en: ' + sib)
        log('  RTE name: ' + footnoteRTE.name)
        log('  texto preview: ' + text.replace(/<[^>]+>/g, '').substring(0, 120) + '...')
        log('  spacer present: ' + analysis.spacerFound)

        const example = {
          sibling: sib,
          analysis,
          footnoteRTE: {
            ...footnoteRTE,
            fullNode: null, // will be filled below
          },
        }

        // Capture the full RTE node for detailed inspection
        const rteRelPath = footnoteRTE.path.replace(siblingBase + '/' + sib + '/jcr:content', '')
        const parts = rteRelPath.split('/').filter(Boolean)
        let rteNode = tree
        for (const p of parts) {
          rteNode = rteNode && rteNode[p]
        }
        if (rteNode) {
          example.footnoteRTE.fullNode = rteNode
        }

        results.siblingExamples.push(example)

        if (text.length > bestFootnoteLength) {
          bestFootnoteLength = text.length
          results.bestExample = example
        }
      }
    }

    // ── Summary Report ────────────────────────────────────────────
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    log('RESUMEN DE EXPLORACION')
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    log('\nEjemplos de footnotes encontrados: ' + results.siblingExamples.length)

    if (results.bestExample) {
      const best = results.bestExample
      log('\nMEJOR EJEMPLO: ' + best.sibling)
      log('  RTE name: ' + best.footnoteRTE.name)
      log('  RTE path: ' + best.footnoteRTE.path)

      log('\n  Propiedades del RTE:')
      for (const [k, v] of Object.entries(best.footnoteRTE.props)) {
        if (k === 'text' || k === 'textAsJson' || k === 'derivedDom') {
          const val = typeof v === 'string' ? v.substring(0, 200) + (v.length > 200 ? '...' : '') : v
          log('    ' + k + ' = ' + JSON.stringify(val))
        } else {
          log('    ' + k + ' = ' + JSON.stringify(v))
        }
      }

      log('\n  Hijos del container padre:')
      for (const child of best.analysis.children) {
        const shortType = child.resourceType.split('/').pop()
        const marker = child.name === best.footnoteRTE.name ? ' <-- FOOTNOTES RTE' :
                       child.resourceType.includes('spacer') ? ' <-- SPACER' : ''
        log('    ' + child.name + ' [' + shortType + ']' + marker)
      }

      // Full HTML for reference
      if (best.footnoteRTE.text) {
        log('\n  HTML completo del footnote RTE:')
        // Show full HTML so we can see all classes
        const fullHtml = best.footnoteRTE.text
        const chunks = fullHtml.match(/.{1,200}/g) || []
        for (const chunk of chunks.slice(0, 50)) {
          log('    ' + chunk)
        }
        if (chunks.length > 50) log('    ... (truncado)')
      }

      if (best.footnoteRTE.textAsJson) {
        log('\n  textAsJson (raw):')
        const jsonStr = typeof best.footnoteRTE.textAsJson === 'string'
          ? best.footnoteRTE.textAsJson : JSON.stringify(best.footnoteRTE.textAsJson)
        // Pretty-print first, then show all of it
        try {
          const parsed = JSON.parse(jsonStr)
          const pretty = JSON.stringify(parsed, null, 2)
          const prettyLines = pretty.split('\n')
          for (const line of prettyLines.slice(0, 80)) {
            log('    ' + line)
          }
          if (prettyLines.length > 80) log('    ... (' + prettyLines.length + ' lineas)')
        } catch (e) {
          const chunks = jsonStr.match(/.{1,200}/g) || []
          for (const chunk of chunks.slice(0, 30)) {
            log('    ' + chunk)
          }
        }
      }

      // Also show derivedDom if different from text
      if (best.footnoteRTE.derivedDom && best.footnoteRTE.derivedDom !== best.footnoteRTE.text) {
        log('\n  derivedDom (diferente de text):')
        const chunks = best.footnoteRTE.derivedDom.match(/.{1,200}/g) || []
        for (const chunk of chunks.slice(0, 20)) {
          log('    ' + chunk)
        }
      }
    } else {
      logWarn('No se encontraron ejemplos de footnotes en siblings.')
      log('Verifica que los blog posts tengan footnotes en el ultimo Theme Container v2.')
    }

    // Dump current page container structure
    if (results.currentPage) {
      log('\n━━ Estructura de pagina actual (ultimo container) ━━')
      log('Path: ' + results.currentPage.containerPath)
      log('Hijos:')
      for (const child of results.currentPage.children) {
        const shortType = child.resourceType.split('/').pop()
        log('  ' + child.name + ' [' + shortType + ']')
        if (Object.keys(child.props).length > 0) {
          for (const [k, v] of Object.entries(child.props)) {
            if (k !== 'jcr:primaryType' && k !== 'sling:resourceType') {
              const val = typeof v === 'string' && v.length > 100 ? v.substring(0, 100) + '...' : v
              log('    ' + k + ' = ' + JSON.stringify(val))
            }
          }
        }
      }
    }

    // Console dumps for detailed inspection
    console.log('[ProbeFootnotes] Current page:', results.currentPage)
    console.log('[ProbeFootnotes] Sibling examples:', results.siblingExamples)
    console.log('[ProbeFootnotes] Best example:', results.bestExample)

    log('\nProbe completo — revisa la consola (F12) para datos detallados.')
    return { success: true, logs, results }
  } catch (err) {
    console.error('[ProbeFootnotes] fatal', err)
    logErr('Error: ' + err.message)
    return { success: false, logs, error: err.message }
  } finally {
    console.groupEnd()
  }
}
